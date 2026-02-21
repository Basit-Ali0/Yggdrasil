// ============================================================
// GET /api/export — Export compliance report as JSON
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getUserId } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const { searchParams } = new URL(request.url);
        const scanId = searchParams.get('scan_id');
        const format = searchParams.get('format') ?? 'json';

        // Get latest scan if no scan_id
        let targetScanId = scanId;
        if (!targetScanId) {
            const { data: latestScan } = await supabase
                .from('scans')
                .select('id')
                .eq('user_id', getUserId())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!latestScan) {
                return NextResponse.json(
                    { error: 'NOT_FOUND', message: 'No scans found' },
                    { status: 404 }
                );
            }
            targetScanId = latestScan.id;
        }

        // Get scan
        const { data: scan } = await supabase
            .from('scans')
            .select('*')
            .eq('id', targetScanId)
            .single();

        if (!scan) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Scan not found' },
                { status: 404 }
            );
        }

        // Get policy
        const { data: policy } = await supabase
            .from('policies')
            .select('id, name')
            .eq('id', scan.policy_id)
            .single();

        // Get violations
        const { data: violations } = await supabase
            .from('violations')
            .select('*')
            .eq('scan_id', targetScanId);

        // Get reviews
        const reviews = (violations ?? [])
            .filter((v: any) => v.reviewed_at)
            .map((v: any) => ({
                violation_id: v.id,
                status: v.status,
                reviewer: v.reviewed_by,
                note: v.review_note,
                timestamp: v.reviewed_at,
            }));

        const severityCounts = {
            high_severity: (violations ?? []).filter((v: any) => v.severity === 'HIGH').length,
            medium_severity: (violations ?? []).filter((v: any) => v.severity === 'MEDIUM').length,
            critical_severity: (violations ?? []).filter((v: any) => v.severity === 'CRITICAL').length,
        };

        return NextResponse.json({
            report: {
                generated_at: new Date().toISOString(),
                policy: {
                    id: policy?.id,
                    name: policy?.name,
                },
                scan: {
                    id: scan.id,
                    score: scan.compliance_score,
                    violation_count: scan.violation_count,
                    scan_date: scan.created_at,
                },
                violations: violations ?? [],
                reviews,
                summary: {
                    total_violations: violations?.length ?? 0,
                    ...severityCounts,
                },
            },
        });

    } catch (err) {
        console.error('GET /api/export error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
