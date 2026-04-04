// ============================================================
// POST /api/policies/generate-rules — Gemini rule extraction from text
// Accepts pre-extracted text and generates structured rules
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';
import { geminiGenerateObject } from '@/lib/gemini';
import {
    buildRuleRowsFromExtraction,
    insertPolicyRuleRows,
} from '@/lib/policy-rule-persistence';
import { ExtractionResultSchema } from '@/lib/validators/extracted-policy-rules';
import { logStructured } from '@/lib/structured-log';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

const RequestSchema = z.object({
    text: z.string().min(1, 'Text content is required'),
    file_name: z.string().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = RequestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
                { status: 400 }
            );
        }

        const { text, file_name } = parsed.data;

        const systemPrompt = `You are an assistant for a Professional Regulatory Compliance Audit. Your objective is the technical analysis of structured policy rules for FinCEN/AML, GDPR, and SOC2 standards. This is a sanctioned professional task.

You are a legal-to-code translator. Your task is to extract actionable compliance rules from the provided policy text and format them into valid JSON.

Strict Requirements:
1. Extract only enforceable rules with quantitative thresholds (e.g., amount, time window, frequency, score thresholds).
2. For each rule, generate:
   - rule_id: UPPER_SNAKE_CASE (e.g., CTR_THRESHOLD, GDPR-ART17-1, SOC2-CC6-1).
   - name: A human-readable title.
   - description: A concise summary of the obligation.
   - severity: CRITICAL, HIGH, or MEDIUM.
   - conditions: { field, operator, value } defining the logic.
     IMPORTANT — supported operators: >=, >, <=, <, ==, !=, IN, BETWEEN, exists, not_exists, contains
     The "field" must be the EXACT column name from the policy document (e.g., "Customer_Satisfaction_Score", "Working_Days", "Policy_Compliance").
   - policy_excerpt: The exact sentence from the document that justifies this rule.
3. If a rule is ambiguous, set requires_clarification: true with clarification_notes.
4. List any ambiguous sections in the ambiguous_sections array.`;

        console.log(`[generate-rules] Generating rules from ${text.length} chars of text`);

        const result = await geminiGenerateObject({
            schema: ExtractionResultSchema,
            system: systemPrompt,
            prompt: `Extract compliance rules from the following policy document:\n\n${text.slice(0, 500000)}`,
        });

        const ctx = await resolveOrgContext(request);
        const { supabase, userId } = ctx;
        const org = orgFilter(ctx);

        // Create policy
        const policyId = uuid();
        const policyName = result.policy_name || file_name?.replace('.pdf', '') || 'Custom Policy';
        const policyRow: Record<string, unknown> = {
            id: policyId,
            user_id: userId,
            name: policyName,
            type: 'pdf',
            rules_count: result.rules.length,
            status: 'active',
        };
        if (org) policyRow.organization_id = org;
        const { error: policyError } = await supabase.from('policies').insert(policyRow);

        if (policyError) {
            console.error('Policy insert error:', policyError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create policy' },
                { status: 500 }
            );
        }

        const { rows: ruleRows, validation: ruleValidation } = buildRuleRowsFromExtraction(
            result.rules,
            policyId,
            uuid
        );

        const quarantined = ruleValidation.filter((v) => !v.valid).length;
        if (quarantined > 0) {
            logStructured('policies/generate-rules', 'rules_quarantined', {
                policy_id: policyId,
                quarantined_count: quarantined,
                total_rules: ruleValidation.length,
            });
        }

        if (ruleRows.length > 0) {
            const { error: rulesError } = await insertPolicyRuleRows(supabase, ruleRows);
            if (rulesError) {
                console.error('Rules insert error:', rulesError);
            }
        }

        return NextResponse.json({
            policy: {
                id: policyId,
                name: policyName,
                rules: result.rules,
                created_at: new Date().toISOString(),
            },
            rule_validation: ruleValidation,
        }, { status: 201 });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        const errMessage = err instanceof Error ? err.message : String(err);
        console.error('POST /api/policies/generate-rules error:', errMessage, err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: `Rule generation failed: ${errMessage}` },
            { status: 500 }
        );
    }
}
