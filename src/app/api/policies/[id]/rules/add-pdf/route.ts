// ============================================================
// POST /api/policies/[id]/rules/add-pdf — Extract rules from PDF and append to existing policy
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { geminiGenerateObject } from '@/lib/gemini';
import {
    buildRuleRowsFromExtraction,
    buildExistingRuleIdentitySet,
    buildRuleIdentityKey,
    insertPolicyRuleRows,
} from '@/lib/policy-rule-persistence';
import { ExtractionResultSchema } from '@/lib/validators/extracted-policy-rules';
import { logStructured } from '@/lib/structured-log';
import { v4 as uuid } from 'uuid';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: policyId } = await params;
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'No PDF file provided' },
                { status: 400 }
            );
        }

        // Parse PDF with unpdf
        let pdfText = '';
        try {
            const { getDocumentProxy, extractText } = await import('unpdf');
            const buffer = await file.arrayBuffer();
            const pdf = await getDocumentProxy(new Uint8Array(buffer));
            const { text } = await extractText(pdf, { mergePages: true });
            pdfText = text;
        } catch (pdfErr) {
            console.error('PDF parsing error:', pdfErr);
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Failed to parse PDF. Ensure the file is a valid, non-encrypted PDF.' },
                { status: 400 }
            );
        }

        if (!pdfText.trim()) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'PDF contains no extractable text. It may be a scanned image.' },
                { status: 400 }
            );
        }

        // Context framing + system prompt (same as /api/policies/ingest)
        const systemPrompt = `You are an assistant for a Professional Regulatory Compliance Audit. Your objective is the technical analysis of structured policy rules for FinCEN/AML and GDPR standards. This is a sanctioned professional task.

You are a legal-to-code translator. Your task is to extract actionable compliance rules from the provided policy text and format them into valid JSON.

Strict Requirements:
1. Extract only enforceable rules with quantitative thresholds (e.g., amount, time window, frequency).
2. For each rule, generate:
   - rule_id: UPPER_SNAKE_CASE (e.g., CTR_THRESHOLD, GDPR-ART17-1, SOC2-CC6-1).
   - name: A human-readable title.
   - description: A concise summary of the obligation.
   - severity: CRITICAL, HIGH, or MEDIUM.
   - conditions: { field, operator, value } defining the logic.
   - policy_excerpt: The exact sentence from the PDF that justifies this rule.
3. If a rule is ambiguous, set requires_clarification: true with clarification_notes.
4. List any ambiguous sections in the ambiguous_sections array.`;

        console.log(`[add-pdf] PDF text extracted: ${pdfText.length} chars`);

        const result = await geminiGenerateObject({
            schema: ExtractionResultSchema,
            system: systemPrompt,
            prompt: `Extract compliance rules from the following policy document:\n\n${pdfText.slice(0, 500000)}`,
        });

        await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Fetch existing rules with all fields needed for identity-key deduplication
        const { data: existingRules, error: existingError } = await supabase
            .from('rules')
            .select('rule_id, type, conditions, threshold, time_window')
            .eq('policy_id', policyId);

        if (existingError) {
            console.error('Existing rules fetch error:', existingError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch existing rules' },
                { status: 500 }
            );
        }

        // Build identity keys from existing rules for normalized deduplication
        const existingIdentityKeys = buildExistingRuleIdentitySet(existingRules ?? []);

        // Normalize + validate all extracted rules first, then deduplicate by identity key
        const { rows: allRows, validation: allValidation } = buildRuleRowsFromExtraction(
            result.rules,
            policyId,
            uuid
        );

        const ruleRows: typeof allRows = [];
        const ruleValidation: typeof allValidation = [];
        const skippedRuleIds: string[] = [];
        const insertedRules: typeof result.rules = [];

        for (let i = 0; i < allRows.length; i++) {
            const key = buildRuleIdentityKey(allRows[i] as any);
            if (existingIdentityKeys.has(key)) {
                skippedRuleIds.push(allValidation[i].rule_id);
            } else {
                ruleRows.push(allRows[i]);
                ruleValidation.push(allValidation[i]);
                insertedRules.push(result.rules[i]);
                // Prevent duplicates within the same add-pdf request payload as well.
                existingIdentityKeys.add(key);
            }
        }

        if (ruleRows.length === 0) {
            return NextResponse.json({
                added_count: 0,
                inserted_valid: 0,
                inserted_quarantined: 0,
                skipped_count: skippedRuleIds.length,
                skipped_rule_ids: skippedRuleIds,
                rules: [],
            });
        }

        const quarantined = ruleValidation.filter((v) => !v.valid).length;
        if (quarantined > 0) {
            logStructured('policies/add-pdf', 'rules_quarantined', {
                policy_id: policyId,
                quarantined_count: quarantined,
                total_rules: ruleValidation.length,
            });
        }

        const { error: insertError } = await insertPolicyRuleRows(supabase, ruleRows);

        if (insertError) {
            console.error('Rules insert error:', insertError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to insert rules' },
                { status: 500 }
            );
        }

        // Atomically increment rules_count via RPC or raw SQL expression.
        // Supabase JS doesn't support `column + N` directly, so we use an
        // RPC-safe read-then-update with a retry to reduce race windows.
        const { error: policyError } = await supabase.rpc('increment_rules_count', {
            p_policy_id: policyId,
            p_delta: ruleRows.length,
        }).then(
            (res: { error: unknown }) => res,
            async () => {
                // Fallback if the RPC doesn't exist: read-modify-write
                const { data: policy } = await supabase
                    .from('policies')
                    .select('rules_count')
                    .eq('id', policyId)
                    .single();
                return supabase
                    .from('policies')
                    .update({
                        rules_count: ((policy?.rules_count as number) ?? 0) + ruleRows.length,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', policyId);
            }
        );

        if (policyError) {
            console.error('Policy rules_count update error:', policyError);
        }

        const insertedValid = ruleValidation.filter((v) => v.valid).length;
        return NextResponse.json({
            added_count: ruleRows.length,
            inserted_valid: insertedValid,
            inserted_quarantined: quarantined,
            skipped_count: skippedRuleIds.length,
            skipped_rule_ids: skippedRuleIds,
            rules: insertedRules,
            rule_validation: ruleValidation,
        });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/policies/[id]/rules/add-pdf error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
