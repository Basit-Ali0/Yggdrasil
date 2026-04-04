// ============================================================
// GET   /api/cases/:id — Case detail with violations + timeline (P3-08)
// PATCH /api/cases/:id — Update case status/disposition/narrative (P3-09)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const { supabase } = ctx;

        const { data: caseData, error } = await supabase
            .from('cases')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !caseData) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Case not found' }, { status: 404 });
        }

        // Fetch violations, timeline, and prior subject cases in parallel
        const [violationsResult, eventsResult, priorResult] = await Promise.all([
            supabase.from('violations').select('*').eq('case_id', id).order('severity', { ascending: true }),
            supabase.from('case_events').select('*').eq('case_id', id).order('created_at', { ascending: true }),
            caseData.organization_id
                ? supabase.from('cases')
                    .select('id, scan_id, status, severity_rollup, violation_count, suspicious_amount, created_at')
                    .eq('organization_id', caseData.organization_id)
                    .eq('subject_key', caseData.subject_key)
                    .neq('id', id)
                    .order('created_at', { ascending: false })
                    .limit(10)
                : { data: null },
        ]);

        const violations = violationsResult.data ?? [];
        const timeline = eventsResult.data ?? [];
        const priorCases = priorResult.data ?? [];

        // Grouped evidence: unique rule families triggered
        const ruleMap = new Map<string, { rule_id: string; rule_name: string; count: number; total_amount: number }>();
        for (const v of violations) {
            const key = (v as any).rule_id;
            if (!ruleMap.has(key)) {
                ruleMap.set(key, { rule_id: key, rule_name: (v as any).rule_name, count: 0, total_amount: 0 });
            }
            const entry = ruleMap.get(key)!;
            entry.count++;
            entry.total_amount += Number((v as any).amount ?? 0);
        }

        // SAR readiness check
        const allViolationsReviewed = violations.every((v: any) => v.status !== 'pending');
        const sarReady = !!(
            caseData.owner_id &&
            caseData.disposition &&
            caseData.narrative &&
            allViolationsReviewed &&
            violations.length > 0
        );

        return NextResponse.json({
            ...caseData,
            violations,
            timeline,
            prior_cases: priorCases,
            grouped_evidence: [...ruleMap.values()],
            review_summary: {
                total: violations.length,
                pending: violations.filter((v: any) => v.status === 'pending').length,
                approved: violations.filter((v: any) => v.status === 'approved').length,
                false_positive: violations.filter((v: any) => v.status === 'false_positive').length,
            },
            sar_ready: sarReady,
        });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('GET /api/cases/[id] error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const { supabase, userId } = ctx;
        const body = await request.json();

        const allowedFields = [
            'status', 'disposition', 'narrative', 'owner_id',
            'sar_date_range_start', 'sar_date_range_end', 'sar_flagged_amount',
            'sar_involved_accounts', 'sar_counterparties', 'sar_analyst_summary',
            'sar_supporting_triggers',
        ];

        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
            latest_activity: new Date().toISOString(),
        };
        for (const field of allowedFields) {
            if (field in body) updates[field] = body[field];
        }

        // SAR readiness gate (P3-20)
        if (body.status === 'sar_prepared') {
            const { data: existing } = await supabase.from('cases').select('owner_id, disposition, narrative').eq('id', id).single();
            const owner = body.owner_id ?? existing?.owner_id;
            const disposition = body.disposition ?? existing?.disposition;
            const narrative = body.narrative ?? existing?.narrative;

            if (!owner || !disposition || !narrative) {
                return NextResponse.json({
                    error: 'VALIDATION_ERROR',
                    message: 'Cannot mark as sar_prepared: owner, disposition, and narrative are required',
                }, { status: 422 });
            }

            const { count } = await supabase.from('violations').select('id', { count: 'exact', head: true }).eq('case_id', id).eq('status', 'pending');
            if ((count ?? 0) > 0) {
                return NextResponse.json({
                    error: 'VALIDATION_ERROR',
                    message: 'Cannot mark as sar_prepared: all violations must be reviewed',
                }, { status: 422 });
            }
        }

        const { data: updated, error } = await supabase
            .from('cases')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        // Record timeline events (P3-13)
        const events: Array<{ event_type: string; payload: Record<string, unknown> }> = [];
        if ('status' in body) events.push({ event_type: 'status_change', payload: { new_status: body.status } });
        if ('disposition' in body) events.push({ event_type: 'disposition_change', payload: { new_disposition: body.disposition } });
        if ('narrative' in body) events.push({ event_type: 'narrative_update', payload: { length: String(body.narrative ?? '').length } });
        if ('owner_id' in body) events.push({ event_type: 'assigned', payload: { new_owner: body.owner_id } });

        for (const evt of events) {
            await supabase.from('case_events').insert({
                case_id: id,
                event_type: evt.event_type,
                actor_id: userId,
                payload: evt.payload,
            });
        }

        return NextResponse.json({ success: true, case: updated });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('PATCH /api/cases/[id] error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
