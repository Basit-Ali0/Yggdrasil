// ============================================================
// GET /api/scan/[id] — Poll scan status (no WebSockets)
// Response per CONTRACTS.md Screen 6 polling
// Includes review summary, delta, and score history when available.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase';

async function calculateDelta(
    supabase: Awaited<ReturnType<typeof getSupabaseForRequest>>,
    scan: any,
    scanId: string
) {
    if (scan.status !== 'completed' || !scan.policy_id) return null;

    const { data: previousScan } = await supabase
        .from('scans')
        .select('id, violation_count')
        .eq('policy_id', scan.policy_id)
        .lt('created_at', scan.created_at)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!previousScan) return null;

    const [currentViolations, previousViolations] = await Promise.all([
        supabase.from('violations').select('rule_id, account').eq('scan_id', scanId),
        supabase.from('violations').select('rule_id, account').eq('scan_id', previousScan.id),
    ]);

    const currentSignatures = new Set(
        (currentViolations.data ?? []).map((violation: any) => `${violation.rule_id}:${violation.account}`)
    );
    const previousSignatures = new Set(
        (previousViolations.data ?? []).map((violation: any) => `${violation.rule_id}:${violation.account}`)
    );

    let newCount = 0;
    let resolvedCount = 0;
    let unchangedCount = 0;

    for (const signature of currentSignatures) {
        if (previousSignatures.has(signature)) unchangedCount++;
        else newCount++;
    }

    for (const signature of previousSignatures) {
        if (!currentSignatures.has(signature)) resolvedCount++;
    }

    return {
        new_count: newCount,
        resolved_count: resolvedCount,
        unchanged_count: unchangedCount,
        previous_scan_id: previousScan.id,
        previous_violation_count: previousScan.violation_count || 0,
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await getSupabaseForRequest(request);

        const { data: scan, error } = await supabase
            .from('scans')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !scan) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Scan not found' },
                { status: 404 }
            );
        }

        const [rulesCountResult, violationsResult, delta] = await Promise.all([
            supabase.from('rules').select('*', { count: 'exact', head: true }).eq('policy_id', scan.policy_id),
            scan.status === 'completed'
                ? supabase.from('violations').select('severity, status').eq('scan_id', id)
                : Promise.resolve({ data: null } as any),
            calculateDelta(supabase, scan, id),
        ]);

        const rulesTotal = rulesCountResult.count ?? 0;
        const violations = violationsResult.data ?? [];

        const reviewSummary = {
            total: violations.length,
            pending: violations.filter((violation: any) => violation.status === 'pending').length,
            approved: violations.filter((violation: any) => violation.status === 'approved').length,
            false_positive: violations.filter((violation: any) => violation.status === 'false_positive').length,
            disputed: violations.filter((violation: any) => violation.status === 'disputed').length,
            by_severity: {} as Record<string, number>,
        };

        for (const violation of violations) {
            const severity = (violation as any).severity ?? 'UNKNOWN';
            reviewSummary.by_severity[severity] = (reviewSummary.by_severity[severity] ?? 0) + 1;
        }

        return NextResponse.json({
            id: scan.id,
            status: scan.status,
            violation_count: scan.violation_count ?? 0,
            compliance_score: scan.compliance_score ?? 0,
            rules_processed: scan.status === 'completed' ? rulesTotal : 0,
            rules_total: rulesTotal,
            created_at: scan.created_at,
            completed_at: scan.completed_at,
            audit_name: scan.audit_name ?? null,
            data_source: scan.data_source ?? 'csv',
            file_name: scan.file_name ?? null,
            score_history: scan.score_history ?? [],
            record_count: scan.record_count ?? 0,
            policy_id: scan.policy_id ?? null,
            upload_id: scan.upload_id ?? null,
            mapping_id: scan.mapping_id ?? null,
            audit_id: scan.audit_id ?? null,
            mapping_config: scan.mapping_config ?? null,
            temporal_scale: scan.temporal_scale ?? null,
            review_summary: reviewSummary,
            delta,
        });
    } catch (err) {
        console.error('GET /api/scan/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await getSupabaseForRequest(request);

        const { error } = await supabase
            .from('scans')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete scan error:', error);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to delete scan' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/scan/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
