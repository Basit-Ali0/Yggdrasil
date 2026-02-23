// ============================================================
// GET /api/scan/history — Scan history for user
// Now includes delta (new/resolved counts) per scan
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';

async function calculateScanDelta(
    supabase: any,
    scan: any,
    allScans: any[]
): Promise<{ new_count: number; resolved_count: number; unchanged_count: number } | null> {
    // Find previous scan for the same policy
    const previousScan = allScans.find(
        (s) => s.policy_id === scan.policy_id && 
               s.created_at < scan.created_at &&
               s.status === 'completed'
    );

    if (!previousScan) return null;

    // Get violations for both scans
    const { data: currentViolations } = await supabase
        .from('violations')
        .select('rule_id, account')
        .eq('scan_id', scan.id);

    const { data: prevViolations } = await supabase
        .from('violations')
        .select('rule_id, account')
        .eq('scan_id', previousScan.id);

    const currentSignatures = new Set(
        (currentViolations || []).map((v: any) => `${v.rule_id}:${v.account}`)
    );
    const prevSignatures = new Set(
        (prevViolations || []).map((v: any) => `${v.rule_id}:${v.account}`)
    );

    let newCount = 0;
    let resolvedCount = 0;

    for (const sig of currentSignatures) {
        if (!prevSignatures.has(sig)) newCount++;
    }
    for (const sig of prevSignatures) {
        if (!currentSignatures.has(sig)) resolvedCount++;
    }

    return {
        new_count: newCount,
        resolved_count: resolvedCount,
        unchanged_count: currentSignatures.size - newCount,
    };
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await getSupabaseForRequest(request);
        const userId = await getUserIdFromRequest(request);

        const { data: scans, error } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch scan history' },
                { status: 500 }
            );
        }

        // Calculate delta for each scan
        const scansWithDelta = await Promise.all(
            (scans ?? []).map(async (s: any) => {
                const delta = await calculateScanDelta(supabase, s, scans ?? []);
                return {
                    id: s.id,
                    policy_id: s.policy_id,
                    score: s.compliance_score,
                    violation_count: s.violation_count,
                    new_violations: delta?.new_count ?? 0,
                    resolved_violations: delta?.resolved_count ?? 0,
                    unchanged_count: delta?.unchanged_count ?? 0,
                    status: s.status,
                    created_at: s.created_at,
                    completed_at: s.completed_at,
                    audit_name: s.audit_name ?? null,
                };
            })
        );

        return NextResponse.json({
            scans: scansWithDelta,
        });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('GET /api/scan/history error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
