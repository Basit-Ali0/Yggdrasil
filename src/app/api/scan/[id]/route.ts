// ============================================================
// GET /api/scan/[id] — Poll scan status (no WebSockets)
// Response per CONTRACTS.md Screen 6 polling
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabase();

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

        return NextResponse.json({
            id: scan.id,
            status: scan.status,
            violation_count: scan.violation_count ?? 0,
            compliance_score: scan.compliance_score ?? 0,
            rules_processed: scan.status === 'completed' ? (rulesTotal ?? 0) : 0,
            rules_total: rulesTotal ?? 0,
            created_at: scan.created_at,
            completed_at: scan.completed_at,
        });

    } catch (err) {
        console.error('GET /api/scan/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
