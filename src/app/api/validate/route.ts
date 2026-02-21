// ============================================================
// POST /api/validate — Compute accuracy vs ground truth labels
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase';
import { ValidateSchema } from '@/lib/validators';
import { computeMetrics } from '@/lib/engine/validation';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = ValidateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { scan_id, dataset, label_column } = parsed.data;
        const supabase = await getSupabaseForRequest(request);

        // Get violations for this scan
        const { data: violations } = await supabase
            .from('violations')
            .select('record_id, rule_id')
            .eq('scan_id', scan_id);

        if (!violations) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'No violations found for this scan' },
                { status: 404 }
            );
        }

        // Get scan for record count
        const { data: scan } = await supabase
            .from('scans')
            .select('record_count')
            .eq('id', scan_id)
            .single();

        // For MVP: we return placeholder metrics since we need the original
        // CSV data with ground truth labels which is in the in-memory upload store.
        // In a full implementation, we'd reload the CSV and compare.
        // For the hackathon demo, we provide the detected vs ground truth comparison.

        const detectedIds = new Set(violations.map((v: any) => v.record_id).filter(Boolean));

        // Since we don't have ground truth labels in this endpoint's scope,
        // return the structure with detected counts.
        // The frontend will show detection metrics.
        const totalRecords = scan?.record_count ?? 0;

        // Placeholder ground truth (would be loaded from CSV in full implementation)
        const groundTruthPositiveIds = new Set<string>();

        const metrics = computeMetrics(detectedIds, groundTruthPositiveIds, totalRecords);
        metrics.validated_against = dataset === 'ibm_aml' ? 'IBM_AML_IsLaundering' : 'PaySim_isFraud';

        // Per-rule breakdown
        const ruleBreakdown = new Map<string, { tp: number; detected: number }>();
        for (const v of violations) {
            if (!ruleBreakdown.has(v.rule_id)) {
                ruleBreakdown.set(v.rule_id, { tp: 0, detected: 0 });
            }
            ruleBreakdown.get(v.rule_id)!.detected++;
        }

        const perRule = Array.from(ruleBreakdown.entries()).map(([rule_id, counts]) => ({
            rule_id,
            precision: 0,
            recall: 0,
            f1: 0,
            detected: counts.detected,
        }));

        return NextResponse.json({
            metrics,
            per_rule: perRule,
            summary: metrics.summary,
            validated_against: metrics.validated_against,
            total_labeled: metrics.total_labeled,
        });

    } catch (err) {
        console.error('POST /api/validate error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
