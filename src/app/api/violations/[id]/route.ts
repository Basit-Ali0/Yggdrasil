// ============================================================
// GET  /api/violations/[id] — Violation detail
// PATCH /api/violations/[id] — Review violation + recalc score
// Response per CONTRACTS.md Screen 8
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getUserId } from '@/lib/supabase';
import { ReviewViolationSchema } from '@/lib/validators';
import { calculateComplianceScore } from '@/lib/engine/scoring';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabase();

        const { data: violation, error } = await supabase
            .from('violations')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !violation) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Violation not found' },
                { status: 404 }
            );
        }

        // Return per CONTRACTS.md Screen 8
        return NextResponse.json({
            id: violation.id,
            scan_id: violation.scan_id,
            rule_id: violation.rule_id,
            rule_name: violation.rule_name,
            severity: violation.severity,
            account: violation.account,
            amount: violation.amount ? parseFloat(violation.amount) : 0,
            transaction_type: violation.transaction_type,
            evidence: violation.evidence,
            threshold: violation.threshold ? parseFloat(violation.threshold) : 0,
            actual_value: violation.actual_value ? parseFloat(violation.actual_value) : 0,
            policy_excerpt: violation.policy_excerpt,
            policy_section: violation.policy_section,
            explanation: violation.explanation,
            status: violation.status,
            review_note: violation.review_note,
            reviewed_at: violation.reviewed_at,
            rule_accuracy: null, // Populated by /api/validate
        });

    } catch (err) {
        console.error('GET /api/violations/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const parsed = ReviewViolationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const userId = getUserId();
        const supabase = getSupabase();

        // Map "rejected" (CONTRACTS.md) to "false_positive" (schema.md)
        const dbStatus = parsed.data.status === 'rejected' ? 'false_positive' : parsed.data.status;

        const { data: updated, error: updateError } = await supabase
            .from('violations')
            .update({
                status: dbStatus,
                review_note: parsed.data.review_note ?? null,
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError || !updated) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Violation not found' },
                { status: 404 }
            );
        }

        // Recalculate compliance score for the scan
        const { data: allViolations } = await supabase
            .from('violations')
            .select('severity, status')
            .eq('scan_id', updated.scan_id);

        const { data: scan } = await supabase
            .from('scans')
            .select('record_count')
            .eq('id', updated.scan_id)
            .single();

        const newScore = calculateComplianceScore(
            scan?.record_count ?? 0,
            (allViolations ?? []).map((v: any) => ({ severity: v.severity, status: v.status }))
        );

        // Update scan score
        await supabase
            .from('scans')
            .update({ compliance_score: newScore })
            .eq('id', updated.scan_id);

        // Return per CONTRACTS.md
        return NextResponse.json({
            success: true,
            violation: {
                id: updated.id,
                status: parsed.data.status, // Return what client sent, not DB value
                reviewed_at: updated.reviewed_at,
            },
            updated_score: newScore,
        });

    } catch (err) {
        console.error('PATCH /api/violations/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
