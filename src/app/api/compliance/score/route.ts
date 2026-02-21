// ============================================================
// GET /api/compliance/score — Get compliance score for a scan
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getScoreStatus, getViolationSummary } from '@/lib/engine/scoring';

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const { searchParams } = new URL(request.url);
        const scanId = searchParams.get('scan_id');

        if (!scanId) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'scan_id is required' },
                { status: 400 }
            );
        }

        const { data: scan } = await supabase
            .from('scans')
            .select('*')
            .eq('id', scanId)
            .single();

        if (!scan) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Scan not found' },
                { status: 404 }
            );
        }

        const { data: violations } = await supabase
            .from('violations')
            .select('severity, status')
            .eq('scan_id', scanId);

        const score = scan.compliance_score ?? 0;
        const { status: scoreStatus, color } = getScoreStatus(score);
        const summary = getViolationSummary(
            (violations ?? []).map((v: any) => ({ severity: v.severity, status: v.status }))
        );

        const total = violations?.length ?? 0;
        const falsePositives = violations?.filter((v: any) => v.status === 'false_positive').length ?? 0;

        return NextResponse.json({
            scan_id: scanId,
            compliance_score: score,
            total_rows_scanned: scan.record_count,
            violation_summary: summary,
            weighted_violations: 0, // computed at scan time
            score_status: scoreStatus,
            color,
            total_violations: total,
            false_positives: falsePositives,
        });

    } catch (err) {
        console.error('GET /api/compliance/score error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
