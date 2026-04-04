// ============================================================
// GET /api/scan/history — Scan history for the current org
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);

        let query = ctx.supabase
            .from('scans')
            .select('*')
            .order('created_at', { ascending: false });

        if (org) {
            query = query.eq('organization_id', org);
        } else {
            query = query.eq('user_id', ctx.userId);
        }

        const { data: scans, error } = await query;

        if (error) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch scan history' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            scans: (scans ?? []).map((s: any) => ({
                id: s.id,
                policy_id: s.policy_id,
                score: s.compliance_score,
                violation_count: s.violation_count,
                status: s.status,
                created_at: s.created_at,
                completed_at: s.completed_at,
                audit_name: s.audit_name ?? null,
            })),
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
