// ============================================================
// GET /api/scan/history — Scan history for user
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getUserIdFromRequest, AuthError } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const userId = await getUserIdFromRequest(request);

        const { data: scans, error } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

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
