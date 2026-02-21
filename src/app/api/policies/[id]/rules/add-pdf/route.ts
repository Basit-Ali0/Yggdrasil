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
