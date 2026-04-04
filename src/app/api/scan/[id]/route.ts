// ============================================================
// GET /api/scan/[id] — Poll scan status (no WebSockets)
// Response per CONTRACTS.md Screen 6 polling
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase';

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

        // Get rules count + review summary in parallel
        const [rulesCountResult, violationsResult] = await Promise.all([
            supabase.from('rules').select('*', { count: 'exact', head: true }).eq('policy_id', scan.policy_id),
            scan.status === 'completed'
                ? supabase.from('violations').select('severity, status').eq('scan_id', id)
                : { data: null },
        ]);

        const rulesTotal = rulesCountResult.count ?? 0;
        const violations = violationsResult.data ?? [];

        const reviewSummary = {
            total: violations.length,
            pending: violations.filter((v: any) => v.status === 'pending').length,
            approved: violations.filter((v: any) => v.status === 'approved').length,
            false_positive: violations.filter((v: any) => v.status === 'false_positive').length,
            disputed: violations.filter((v: any) => v.status === 'disputed').length,
            by_severity: {} as Record<string, number>,
        };

        for (const v of violations) {
            const s = (v as any).severity ?? 'UNKNOWN';
            reviewSummary.by_severity[s] = (reviewSummary.by_severity[s] ?? 0) + 1;
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
            policy_id: scan.policy_id ?? null,
            upload_id: scan.upload_id ?? null,
            mapping_id: scan.mapping_id ?? null,
            audit_id: scan.audit_id ?? null,
            mapping_config: scan.mapping_config ?? null,
            temporal_scale: scan.temporal_scale ?? null,
            review_summary: reviewSummary,
        });

    } catch (err) {
        console.error('GET /api/scan/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
