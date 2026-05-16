// ============================================================
// GET /api/scan/history — Scan history for the current org
// Includes delta (new/resolved counts) per scan
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';

async function calculateScanDelta(
    supabase: any,
    scan: any,
    allScans: any[]
): Promise<{ new_count: number; resolved_count: number; unchanged_count: number } | null> {
    const previousScan = allScans.find(
        (candidate) =>
            candidate.policy_id === scan.policy_id &&
            candidate.created_at < scan.created_at &&
            candidate.status === 'completed'
    );

    if (!previousScan) return null;

    const { data: currentViolations } = await supabase
        .from('violations')
        .select('rule_id, account')
        .eq('scan_id', scan.id);

    const { data: previousViolations } = await supabase
        .from('violations')
        .select('rule_id, account')
        .eq('scan_id', previousScan.id);

    const currentSignatures = new Set(
        (currentViolations ?? []).map((violation: any) => `${violation.rule_id}:${violation.account}`)
    );
    const previousSignatures = new Set(
        (previousViolations ?? []).map((violation: any) => `${violation.rule_id}:${violation.account}`)
    );

    let newCount = 0;
    let resolvedCount = 0;

    for (const signature of currentSignatures) {
        if (!previousSignatures.has(signature)) newCount++;
    }
    for (const signature of previousSignatures) {
        if (!currentSignatures.has(signature)) resolvedCount++;
    }

    return {
        new_count: newCount,
        resolved_count: resolvedCount,
        unchanged_count: currentSignatures.size - newCount,
    };
}

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);

        let query = ctx.supabase
            .from('scans')
            .select('*')
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

        if (org) query = query.eq('organization_id', org);
        else query = query.eq('user_id', ctx.userId);

        const { data: scans, error } = await query;

        if (error) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch scan history' },
                { status: 500 }
            );
        }

        const scansWithDelta = await Promise.all(
            (scans ?? []).map(async (scan: any) => {
                const delta = await calculateScanDelta(ctx.supabase, scan, scans ?? []);
                return {
                    id: scan.id,
                    policy_id: scan.policy_id,
                    score: scan.compliance_score,
                    violation_count: scan.violation_count,
                    new_violations: delta?.new_count ?? 0,
                    resolved_violations: delta?.resolved_count ?? 0,
                    unchanged_count: delta?.unchanged_count ?? 0,
                    status: scan.status,
                    created_at: scan.created_at,
                    completed_at: scan.completed_at,
                    audit_name: scan.audit_name ?? null,
                    data_source: scan.data_source ?? 'csv',
                    connector_id: scan.connector_id ?? null,
                    file_name: scan.file_name ?? null,
                };
            })
        );

        return NextResponse.json({ scans: scansWithDelta });
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
