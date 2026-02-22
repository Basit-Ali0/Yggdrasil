// ============================================================
// POST /api/policies/generate-rules — Gemini rule extraction from text
// Accepts pre-extracted text and generates structured rules
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { geminiGenerateObject } from '@/lib/gemini';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

// Zod schema for extracted rules — matches LLMSystemPrompts.md
const ExtractedRuleSchema = z.object({
    rule_id: z.string(),
    name: z.string(),
    description: z.string(),
    type: z.string(),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
    threshold: z.number().nullable().optional(),
    time_window: z.number().nullable().optional(),
    conditions: z.object({
        field: z.string(),
        operator: z.string(),
        value: z.any(),
    }),
    policy_excerpt: z.string(),
    policy_section: z.string().optional(),
    requires_clarification: z.boolean().optional(),
    clarification_notes: z.string().optional(),
});

const ExtractionResultSchema = z.object({
    policy_name: z.string(),
    rules: z.array(ExtractedRuleSchema),
    ambiguous_sections: z.array(z.string()).optional(),
});

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

        const systemPrompt = `You are a legal-to-code translator specializing in regulatory compliance auditing. Your task is to extract actionable compliance rules from the provided policy text and format them into a structured JSON array.

Your primary objective is to maximize PRECISION while maintaining high recall. Avoid broad rules that trigger excessive false positives.

### 🛡️ SIGNAL SPECIFICITY FRAMEWORK

Every rule you generate MUST be categorized by its "Signal Specificity." A rule will only be considered valid if it achieves a "High Precision" score (Combined specificity of 2.0 or higher).

1. WEAK SIGNALS (Specificity: 0.5)
   - Single thresholds (Amount > X, Age < Y).
   - Single state checks (Is Active, Is Valid).
   - Basic formatting (Matches Pattern).

2. MEDIUM SIGNALS (Specificity: 1.0)
   - Temporal windows (Within 24 hours).
   - Behavioral shifts (Dormant to Active, Full to Empty).
   - Cardinality changes (New beneficiary, New IP).

3. STRONG SIGNALS (Specificity: 2.0)
   - Multiple state dependencies (A is true AND B is false).
   - Cross-field discrepancies (A does not match B).
   - Recursive patterns (A has happened N times previously).

⚠️ MANDATORY RULE: EVERY rule you extract MUST combine signals such that the TOTAL SPECIFICITY is >= 2.0.
❌ DO NOT extract rules with only one "Weak Signal" (e.g., just a threshold).

### 🧠 ADVERSARIAL REFINEMENT PROCESS

For every rule you identify:
1. IDENTIFY the base requirement.
2. BRAINSTORM a legitimate scenario that would trigger a broad version of this rule (False Positive).
3. ADD conditions (Behavioral, Temporal, or Relational) to EXCLUDE that scenario while still catching the actual violation.

### 📋 JSON SCHEMA REQUIREMENTS

- rule_id: UPPER_SNAKE_CASE.
- severity: Based on specificity (3.0+ = CRITICAL, 2.0-3.0 = HIGH, < 2.0 = MEDIUM).
- conditions: Use recursive { AND: [...] } or { OR: [...] }.
- value_type: Use "field" for cross-field comparison, or "literal".
- policy_excerpt: Exact sentence justifying the rule.

Return ONLY a valid JSON array matching the ExtractionResultSchema.`;

        console.log(`[generate-rules] Generating rules from ${text.length} chars of text`);

        const result = await geminiGenerateObject({
            schema: ExtractionResultSchema,
            system: systemPrompt,
            prompt: `Extract compliance rules from the following policy document:\n\n${text.slice(0, 500000)}`,
        });

        const userId = await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Create policy
        const policyId = uuid();
        const policyName = result.policy_name || file_name?.replace('.pdf', '') || 'Custom Policy';
        const { error: policyError } = await supabase
            .from('policies')
            .insert({
                id: policyId,
                user_id: userId,
                name: policyName,
                type: 'pdf',
                rules_count: result.rules.length,
                status: 'active',
            });

        if (policyError) {
            console.error('Policy insert error:', policyError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create policy' },
                { status: 500 }
            );
        }

        // Insert rules
        const ruleRows = result.rules.map((rule) => ({
            id: uuid(),
            policy_id: policyId,
            rule_id: rule.rule_id,
            name: rule.name,
            type: rule.type,
            description: rule.description,
            threshold: rule.threshold ?? null,
            time_window: rule.time_window ?? null,
            severity: rule.severity,
            conditions: rule.conditions,
            policy_excerpt: rule.policy_excerpt,
            policy_section: rule.policy_section ?? null,
            is_active: true,
        }));

        if (ruleRows.length > 0) {
            const { error: rulesError } = await supabase.from('rules').insert(ruleRows);
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
        }, { status: 201 });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/policies/generate-rules error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
