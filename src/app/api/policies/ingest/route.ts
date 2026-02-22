// ============================================================
// POST /api/policies/ingest — PDF upload + Gemini rule extraction
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { geminiGenerateObject } from '@/lib/gemini';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

// Zod schema for extracted rules — matches LLMSystemPrompts.md
// Conditions can be simple { field, operator, value } or compound { AND: [...] } / { OR: [...] }
// Using z.any() because Zod doesn't support recursive schemas without z.lazy, and
// the engine's evaluateLogic() already validates structure at runtime.
const ExtractedRuleSchema = z.object({
    rule_id: z.string(),
    name: z.string(),
    description: z.string(),
    type: z.string(),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
    threshold: z.number().nullable().optional(),
    time_window: z.number().nullable().optional(),
    conditions: z.any(),
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

export async function POST(request: NextRequest) {
    try {
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

        // Context framing + system prompt per LLMSystemPrompts.md §1
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

- rule_id: UPPER_SNAKE_CASE (e.g., DATA_RETENTION_VIOLATION, MFA_REQUIRED).
- type: A descriptive category for the rule (e.g., "retention", "encryption", "access_control", "consent", "single_transaction"). Use any descriptive string — the engine routes unknown types to single-record evaluation.
- severity: Based on specificity (3.0+ = CRITICAL, 2.0-3.0 = HIGH, < 2.0 = MEDIUM).
- conditions: Use recursive { AND: [...] } or { OR: [...] } to combine multiple conditions. Each leaf condition: { field: "<csv_column_name>", operator: "<op>", value: <expected> }.
- SUPPORTED OPERATORS: "equals", "not_equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal", "contains", "exists", "not_exists", "IN", "BETWEEN", "MATCH" (regex).
- value_type: Use "field" for cross-field comparison (value references another column), or "literal" (default).
- value types: Use booleans (true/false) for boolean fields, numbers for numeric fields, strings for text fields. The engine handles type coercion from CSV strings automatically.
- policy_excerpt: Exact sentence from the policy justifying the rule.
- threshold: Only set for numeric threshold rules (e.g., amount > 10000). Leave null for boolean/state-check rules.

Return ONLY a valid JSON array matching the ExtractionResultSchema.`;

        // Gemini 2.0 Flash supports ~1M tokens (~4M chars), so 500K chars is safe
        console.log(`[ingest] PDF text extracted: ${pdfText.length} chars`);

        const result = await geminiGenerateObject({
            schema: ExtractionResultSchema,
            system: systemPrompt,
            prompt: `Extract compliance rules from the following policy document:\n\n${pdfText.slice(0, 500000)}`,
        });

        const userId = await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Create policy
        const policyId = uuid();
        const { error: policyError } = await supabase
            .from('policies')
            .insert({
                id: policyId,
                user_id: userId,
                name: result.policy_name || file.name.replace('.pdf', ''),
                type: 'pdf',
                rules_count: result.rules.length,
                status: 'active',
            });

        if (policyError) {
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
            await supabase.from('rules').insert(ruleRows);
        }

        return NextResponse.json({
            policy: {
                id: policyId,
                name: result.policy_name || file.name,
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
        console.error('POST /api/policies/ingest error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
