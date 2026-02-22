// ============================================================
// Zod Validators — API request/response validation
// ============================================================

import { z } from 'zod';

// ── POST /api/audits ─────────────────────────────────────────
export const CreateAuditSchema = z.object({
    name: z.string().min(1),
    policy_type: z.enum(['aml', 'gdpr', 'soc2', 'pdf']),
    selected_categories: z.array(z.string()).optional(),
});

// ── POST /api/policies/prebuilt ──────────────────────────────
export const PrebuiltPolicySchema = z.object({
    type: z.enum(['aml', 'gdpr', 'soc2']),
});

// ── POST /api/data/mapping/confirm ───────────────────────────
export const ConfirmMappingSchema = z.object({
    upload_id: z.string().uuid(),
    mapping_config: z.record(z.string(), z.string()),
    temporal_scale: z.number(),
    clarification_answers: z.array(
        z.object({
            question_id: z.string(),
            answer: z.string(),
        })
    ).default([]),
});

// ── POST /api/scan/run ───────────────────────────────────────
export const RunScanSchema = z.object({
    audit_id: z.string().uuid(),
    policy_id: z.string().uuid(),
    upload_id: z.string().uuid(),
    mapping_id: z.string().uuid(),
    audit_name: z.string().optional(),
});

// ── PATCH /api/violations/:id ────────────────────────────────
export const ReviewViolationSchema = z.object({
    status: z.enum(['approved', 'false_positive']),
    review_note: z.string().optional(),
});

// ── POST /api/validate ───────────────────────────────────────
export const ValidateSchema = z.object({
    scan_id: z.string().uuid(),
    dataset: z.enum(['ibm_aml', 'paysim']),
    label_column: z.enum(['IsLaundering', 'isFraud']),
});
