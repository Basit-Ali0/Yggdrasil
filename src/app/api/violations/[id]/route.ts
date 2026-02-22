// ============================================================
// GET  /api/violations/[id] — Violation detail
// PATCH /api/violations/[id] — Review violation + recalc score
// Response per CONTRACTS.md Screen 8
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { ReviewViolationSchema } from '@/lib/validators';
import { calculateComplianceScore } from '@/lib/engine/scoring';
import { knowledgeService } from '@/lib/services/knowledge-service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await getSupabaseForRequest(request);

        const { data: violation, error } = await supabase
            .from('violations')
            .select(`
                *,
                scan:scans(
                    policy:policies(
                        rules(rule_id, description)
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (error || !violation) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Violation not found' },
                { status: 404 }
            );
        }

        // Extract historical context from the rule description
        const rules = (violation.scan as any)?.policy?.rules as any[];
        const matchingRule = rules?.find(r => r.rule_id === violation.rule_id);

        let historicalContext = null;
        let fullArticleText = null;

        if (matchingRule?.description) {
            try {
                const parsed = JSON.parse(matchingRule.description);
                historicalContext = parsed.historical_context;

                if (historicalContext?.article_reference) {
                    const articleNum = historicalContext.article_reference;

                    // Fetch live data from Kaggle CSVs via KnowledgeService
                    const [liveBenchmark, articleData] = await Promise.all([
                        knowledgeService.getBenchmarkData(articleNum),
                        knowledgeService.getArticleText(articleNum)
                    ]);

                    if (liveBenchmark) {
                        historicalContext = {
                            ...historicalContext,
                            avg_fine: `€${(liveBenchmark.avgFine / 1000).toFixed(1)}k (Live Kaggle Data)`,
                            breach_example: liveBenchmark.sampleSummary,
                            total_cases: liveBenchmark.count,
                            max_fine: `€${(liveBenchmark.maxFine / 1000).toFixed(1)}k`
                        };
                    }

                    if (articleData && articleData.length > 0) {
                        fullArticleText = articleData;
                    }
                }
            } catch (e) {
                // Fallback if not JSON
            }
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
            historical_context: historicalContext,
            full_article_text: fullArticleText
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

        const userId = await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Status is now unified: both frontend and DB use 'approved' | 'false_positive'
        const dbStatus = parsed.data.status;

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
            .select('record_count, policy_id')
            .eq('id', updated.scan_id)
            .single();

        // ── Bayesian Feedback Loop ─────────────────────────────
        // Increment the parent rule's approved or false_positive count
        if (scan?.policy_id && updated.rule_id) {
            const columnToIncrement = dbStatus === 'approved'
                ? 'approved_count'
                : 'false_positive_count';

            try {
                await supabase.rpc('increment_rule_stat', {
                    target_policy_id: scan.policy_id,
                    target_rule_id: updated.rule_id,
                    stat_column: columnToIncrement
                });
            } catch (rpcErr) {
                console.warn('[violations/PATCH] increment_rule_stat RPC failed (migration may not be applied):', rpcErr);
            }
        }

        const newScore = calculateComplianceScore(
            scan?.record_count ?? 0,
            (allViolations ?? []).map((v: any) => ({ severity: v.severity, status: v.status }))
        );

        // Update scan score
        await supabase
            .from('scans')
            .update({ compliance_score: newScore })
            .eq('id', updated.scan_id);

        // Track score history for compliance trend chart
        try {
            const { data: scanData } = await supabase
                .from('scans')
                .select('score_history')
                .eq('id', updated.scan_id)
                .single();
            const history = Array.isArray(scanData?.score_history) ? scanData.score_history : [];
            history.push({
                score: newScore,
                timestamp: new Date().toISOString(),
                action: dbStatus === 'false_positive' ? 'false_positive' : 'approved',
                violation_id: id,
            });
            await supabase
                .from('scans')
                .update({ score_history: history })
                .eq('id', updated.scan_id);
        } catch (historyErr) {
            // score_history column may not exist yet — non-critical
            console.warn('[violations/PATCH] score_history update failed:', historyErr);
        }

        // Return per CONTRACTS.md
        return NextResponse.json({
            success: true,
            violation: {
                id: updated.id,
                status: updated.status,
                reviewed_at: updated.reviewed_at,
            },
            updated_score: newScore,
        });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('PATCH /api/violations/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
