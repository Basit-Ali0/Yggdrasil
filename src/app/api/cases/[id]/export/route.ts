// ============================================================
// GET /api/cases/:id/export — Export case as JSON or PDF (P3-21/P3-23)
// ?format=json|pdf
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';
import { generatePdfBuffer } from '@/lib/pdf-report';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);
        const format = new URL(request.url).searchParams.get('format') ?? 'json';

        // Fetch case + violations + events + org info in parallel
        const [caseResult, violationsResult, eventsResult, orgResult] = await Promise.all([
            ctx.supabase.from('cases').select('*').eq('id', id).single(),
            ctx.supabase.from('violations').select('*').eq('case_id', id),
            ctx.supabase.from('case_events').select('*').eq('case_id', id).order('created_at', { ascending: true }),
            org ? ctx.supabase.from('organizations').select('id, name').eq('id', org).single() : { data: null },
        ]);

        const caseData = caseResult.data;
        if (!caseData) {
            return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }

        const violations = violationsResult.data ?? [];
        const events = eventsResult.data ?? [];
        const orgData = orgResult.data as { id: string; name: string } | null;

        const generatedAt = new Date().toISOString();

        // Build by-severity summary
        const bySeverity: Record<string, number> = {};
        for (const v of violations) {
            const s = (v as any).severity ?? 'UNKNOWN';
            bySeverity[s] = (bySeverity[s] ?? 0) + 1;
        }

        // Build by-rule summary
        const byRule = new Map<string, { rule_id: string; rule_name: string; count: number; total_amount: number }>();
        for (const v of violations) {
            const key = (v as any).rule_id;
            if (!byRule.has(key)) byRule.set(key, { rule_id: key, rule_name: (v as any).rule_name, count: 0, total_amount: 0 });
            const entry = byRule.get(key)!;
            entry.count++;
            entry.total_amount += Number((v as any).amount ?? 0);
        }

        // Notes from timeline
        const notes = events
            .filter((e: any) => e.event_type === 'note')
            .map((e: any) => ({
                content: e.payload?.content ?? '',
                actor_id: e.actor_id,
                created_at: e.created_at,
            }));

        const casePacket = {
            generated_at: generatedAt,
            organization: orgData ? { id: orgData.id, name: orgData.name } : null,
            case: {
                id: caseData.id,
                subject_key: caseData.subject_key,
                subject_type: caseData.subject_type,
                status: caseData.status,
                disposition: caseData.disposition,
                severity_rollup: caseData.severity_rollup,
                priority_score: caseData.priority_score,
                narrative: caseData.narrative,
                owner_id: caseData.owner_id,
                created_at: caseData.created_at,
                updated_at: caseData.updated_at,
            },
            sar_prep: {
                narrative: caseData.narrative,
                date_range_start: caseData.sar_date_range_start,
                date_range_end: caseData.sar_date_range_end,
                flagged_amount: caseData.sar_flagged_amount ?? caseData.suspicious_amount,
                involved_accounts: caseData.sar_involved_accounts ?? [caseData.subject_key],
                counterparties: caseData.sar_counterparties ?? [],
                analyst_summary: caseData.sar_analyst_summary,
                supporting_triggers: caseData.sar_supporting_triggers ?? [...byRule.values()],
            },
            violations,
            notes,
            timeline: events,
            summary: {
                total_violations: violations.length,
                suspicious_amount: caseData.suspicious_amount,
                counterparty_count: caseData.counterparty_count,
                by_severity: bySeverity,
                by_rule: [...byRule.values()],
            },
        };

        // Log export
        try {
            const logRow: Record<string, unknown> = {
                user_id: ctx.userId,
                scan_id: caseData.scan_id,
                format,
            };
            if (org) logRow.organization_id = org;
            await ctx.supabase.from('export_logs').insert(logRow);
        } catch { /* table may not exist */ }

        if (format === 'pdf') {
            const pdfData = {
                organization: orgData ? { name: orgData.name } : undefined,
                audit: { name: `Case: ${caseData.subject_key}` },
                policy: { name: 'AML Investigation', type: 'aml' },
                scan: {
                    id: caseData.scan_id,
                    compliance_score: 0,
                    record_count: violations.length,
                    violation_count: violations.length,
                    created_at: caseData.created_at,
                    completed_at: caseData.updated_at,
                },
                violations: violations.map((v: any) => ({
                    rule_id: v.rule_id,
                    rule_name: v.rule_name,
                    severity: v.severity,
                    account: v.account,
                    amount: v.amount,
                    status: v.status,
                    explanation: v.explanation,
                })),
                reviews: {
                    total: violations.length,
                    approved: violations.filter((v: any) => v.status === 'approved').length,
                    false_positive: violations.filter((v: any) => v.status === 'false_positive').length,
                    disputed: 0,
                    pending: violations.filter((v: any) => v.status === 'pending').length,
                },
                summary: { by_severity: bySeverity },
                generated_at: generatedAt,
            };

            const pdfBuf = await generatePdfBuffer(pdfData);
            const shortId = id.slice(0, 8);

            return new NextResponse(pdfBuf, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="yggdrasil-case-${shortId}.pdf"`,
                    'Content-Length': String(pdfBuf.byteLength),
                },
            });
        }

        return NextResponse.json({ case_packet: casePacket });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('GET /api/cases/[id]/export error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
