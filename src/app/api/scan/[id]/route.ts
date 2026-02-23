// ============================================================
// GET /api/scan/[id] — Poll scan status (no WebSockets)
// Response per CONTRACTS.md Screen 6 polling
// Delta calculation added: compares with previous scan
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

        // Get rules count for progress
        const { count: rulesTotal } = await supabase
            .from('rules')
            .select('*', { count: 'exact', head: true })
            .eq('policy_id', scan.policy_id);

        // Calculate delta against previous scan
        let delta = null;
        if (scan.status === 'completed' && scan.policy_id) {
            // Find previous scan for the same policy
            const { data: previousScan } = await supabase
                .from('scans')
                .select('id, violation_count')
                .eq('policy_id', scan.policy_id)
                .lt('created_at', scan.created_at)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (previousScan) {
                // Get current scan violations
                const { data: currentViolations } = await supabase
                    .from('violations')
                    .select('rule_id, account')
                    .eq('scan_id', id);

                // Get previous scan violations
                const { data: prevViolations } = await supabase
                    .from('violations')
                    .select('rule_id, account')
                    .eq('scan_id', previousScan.id);

                // Create signatures: rule_id + account
                const currentSignatures = new Set(
                    (currentViolations || []).map(v => `${v.rule_id}:${v.account}`)
                );
                const prevSignatures = new Set(
                    (prevViolations || []).map(v => `${v.rule_id}:${v.account}`)
                );

                // Calculate delta
                let newCount = 0;
                let resolvedCount = 0;
                let unchangedCount = 0;

                for (const sig of currentSignatures) {
                    if (prevSignatures.has(sig)) {
                        unchangedCount++;
                    } else {
                        newCount++;
                    }
                }

                for (const sig of prevSignatures) {
                    if (!currentSignatures.has(sig)) {
                        resolvedCount++;
                    }
                }

                delta = {
                    new_count: newCount,
                    resolved_count: resolvedCount,
                    unchanged_count: unchangedCount,
                    previous_scan_id: previousScan.id,
                    previous_violation_count: previousScan.violation_count || 0,
                };
            }
        }

        return NextResponse.json({
            id: scan.id,
            status: scan.status,
            violation_count: scan.violation_count ?? 0,
            compliance_score: scan.compliance_score ?? 0,
            rules_processed: scan.status === 'completed' ? (rulesTotal ?? 0) : 0,
            rules_total: rulesTotal ?? 0,
            created_at: scan.created_at,
            completed_at: scan.completed_at,
            audit_name: scan.audit_name ?? null,
            score_history: scan.score_history ?? [],
            record_count: scan.record_count ?? 0,
            // Rescan fields
            policy_id: scan.policy_id ?? null,
            upload_id: scan.upload_id ?? null,
            mapping_id: scan.mapping_id ?? null,
            audit_id: scan.audit_id ?? null,
            mapping_config: scan.mapping_config ?? null,
            temporal_scale: scan.temporal_scale ?? null,
            // Delta
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
