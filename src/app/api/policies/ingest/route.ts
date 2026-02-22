// ============================================================
// POST /api/policies/ingest — PDF upload + Gemini rule extraction
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

        // Parse PDF with unpdf, with fallback to raw text
        let pdfText = '';
        const buffer = await file.arrayBuffer();
        try {
            const { getDocumentProxy, extractText } = await import('unpdf');
            const pdf = await getDocumentProxy(new Uint8Array(buffer.slice(0)));
            const { text } = await extractText(pdf, { mergePages: true });
            pdfText = text;
        } catch (pdfErr) {
            console.warn('PDF parsing error, attempting plain text fallback:', pdfErr);
            // Fallback: If it's a raw text/markdown file renamed to .pdf, read it as UTF-8
            try {
                pdfText = new TextDecoder('utf-8').decode(buffer);
                // If the decoded text still looks like binary junk (contains lots of null bytes/unprintable chars), clear it
                if (pdfText.includes('\x00\x00\x00')) {
                    throw new Error('Likely binary garbage');
                }
            } catch (textErr) {
                return NextResponse.json(
                    { error: 'VALIDATION_ERROR', message: 'Failed to parse PDF. Ensure the file is a valid, non-encrypted PDF.' },
                    { status: 400 }
                );
            }
        }

        if (!pdfText.trim()) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'PDF contains no extractable text. It may be a scanned image.' },
                { status: 400 }
            );
        }

        // Context framing + system prompt per LLMSystemPrompts.md §1
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
