import { z } from 'zod';

export const PIIColumnAnalysisSchema = z.object({
    column_name: z.string(),
    contains_pii: z.boolean(),
    pii_type: z.enum([
        'email', 'phone', 'ssn', 'name', 'address', 'date_of_birth',
        'credit_card', 'ip_address', 'passport', 'national_id', 'bank_account', 'other',
    ]),
    confidence: z.number().min(0).max(1),
    detection_regex: z.string(),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM']),
    violation_text: z.string(),
    suggestion: z.string(),
    sample_evidence: z.array(z.string()).max(3),
});

export const PIIDetectionResultSchema = z.object({
    summary: z.string(),
    columns_analyzed: z.number(),
    pii_columns_found: z.number(),
    findings: z.array(PIIColumnAnalysisSchema),
});

export type PIIDetectionResult = z.infer<typeof PIIDetectionResultSchema>;
export type PIIColumnAnalysis = z.infer<typeof PIIColumnAnalysisSchema>;
