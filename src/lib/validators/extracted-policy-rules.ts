// ============================================================
// Zod schemas — LLM policy extraction (ingest + generate-rules)
// ============================================================

import type { Rule } from '@/lib/types';
import { z } from 'zod';

export const ExtractedRuleSchema = z.object({
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

export const ExtractionResultSchema = z.object({
    policy_name: z.string(),
    rules: z.array(ExtractedRuleSchema),
    ambiguous_sections: z.array(z.string()).optional(),
});

export type RawExtractedRule = z.infer<typeof ExtractedRuleSchema>;

/** Map Gemini/Zod extraction row → engine `Rule` (before normalization/validation). */
export function rawExtractedRuleToRule(raw: RawExtractedRule): Rule {
    return {
        rule_id: raw.rule_id.trim(),
        name: raw.name,
        type: raw.type,
        severity: raw.severity,
        threshold: raw.threshold ?? null,
        time_window: raw.time_window ?? null,
        conditions: raw.conditions,
        policy_excerpt: raw.policy_excerpt,
        policy_section: raw.policy_section ?? '',
        is_active: true,
        description: raw.description,
    };
}
