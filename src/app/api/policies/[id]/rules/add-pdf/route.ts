// ============================================================
// POST /api/policies/[id]/rules/add-pdf — Extract rules from PDF and append to existing policy
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { geminiGenerateObject } from '@/lib/gemini';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

// Zod schema for extracted rules — matches /api/policies/ingest
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

        console.log(`[add-pdf] PDF text extracted: ${pdfText.length} chars`);

        const result = await geminiGenerateObject({
            schema: ExtractionResultSchema,
            system: systemPrompt,
            prompt: `Extract compliance rules from the following policy document:\n\n${pdfText.slice(0, 500000)}`,
        });

        await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Get existing rule_ids for this policy to avoid duplicates
        const { data: existingRules, error: existingError } = await supabase
            .from('rules')
            .select('rule_id')
            .eq('policy_id', policyId);

        if (existingError) {
            console.error('Existing rules fetch error:', existingError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch existing rules' },
                { status: 500 }
            );
        }

        const existingRuleIds = new Set((existingRules ?? []).map((r: any) => r.rule_id));

        // Filter out duplicates
        const newRules = result.rules.filter(rule => !existingRuleIds.has(rule.rule_id));

        if (newRules.length === 0) {
            return NextResponse.json({ added_count: 0, rules: [] });
        }

        // Insert new rules
        const ruleRows = newRules.map((rule) => ({
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

        const { error: insertError } = await supabase
            .from('rules')
            .insert(ruleRows);

        if (insertError) {
            console.error('Rules insert error:', insertError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to insert rules' },
                { status: 500 }
            );
        }

        // Update policy: increment rules_count and set updated_at
        const { data: policy, error: fetchError } = await supabase
            .from('policies')
            .select('rules_count')
            .eq('id', policyId)
            .single();

        if (fetchError || !policy) {
            console.error('Policy fetch error:', fetchError);
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Policy not found' },
                { status: 404 }
            );
        }

        const { error: policyError } = await supabase
            .from('policies')
            .update({
                rules_count: (policy.rules_count ?? 0) + newRules.length,
                updated_at: new Date().toISOString(),
            })
            .eq('id', policyId);

        if (policyError) {
            console.error('Policy update error:', policyError);
        }

        return NextResponse.json({
            added_count: newRules.length,
            rules: newRules,
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
