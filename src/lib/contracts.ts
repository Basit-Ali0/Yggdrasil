// ============================================================
// Frontend Contracts — Yggdrasil
// Matches CONTRACTS.md exactly for screen transitions
// ============================================================

import type { Rule, Violation, ClarificationQuestion } from './types';

// ── Screen 2 → 3: POST /api/audits ──────────────────────────
export interface CreateAuditRequest {
    name: string;
    policy_type: 'aml' | 'gdpr' | 'soc2';
    selected_categories?: string[];
}

export interface CreateAuditResponse {
    audit_id: string;
    policy_id: string;
    rules: Rule[];
}

// ── Screen 3 → 4: POST /api/data/upload ─────────────────────
export interface UploadDataResponse {
    upload_id: string;
    row_count: number;
    headers: string[];
    sample_rows: Record<string, unknown>[];
    detected_dataset: 'IBM_AML' | 'PAYSIM' | 'GENERIC';
    suggested_mapping: Record<string, string>;
    mapping_confidence: Record<string, number>;
    temporal_scale: number;
    clarification_questions: ClarificationQuestion[];
}

// ── Screen 5 → 6: POST /api/data/mapping/confirm ────────────
export interface ConfirmMappingRequest {
    upload_id: string;
    mapping_config: Record<string, string>;
    temporal_scale: number;
    clarification_answers: Array<{ question_id: string; answer: string }>;
}

export interface ConfirmMappingResponse {
    mapping_id: string;
    ready_to_scan: boolean;
}

// ── Screen 5 → 6: POST /api/scan/run ────────────────────────
export interface StartScanRequest {
    audit_id: string;
    policy_id: string;
    upload_id: string;
    mapping_id: string;
    audit_name?: string;
}

export interface StartScanResponse {
    scan_id: string;
    status: 'running';
}

// ── Screen 6 polling: GET /api/scan/:id ──────────────────────
export interface ScanStatusResponse {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    violation_count: number;
    compliance_score: number;
    rules_processed: number;
    rules_total: number;
    created_at: string;
    completed_at: string | null;
    audit_name?: string;
    // Rescan fields
    policy_id?: string;
    upload_id?: string;
    mapping_id?: string;
    audit_id?: string;
    mapping_config?: Record<string, string>;
    temporal_scale?: number;
}

// ── Screen 7: GET /api/violations/cases ──────────────────────
export interface ViolationCase {
    account_id: string;
    violation_count: number;
    max_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    top_rule: string;
    total_amount: number;
    violations: Array<{
        id: string;
        rule_id: string;
        severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
        amount: number;
        explanation: string;
    }>;
}

export interface ViolationCasesResponse {
    cases: ViolationCase[];
    total_cases: number;
    total_violations: number;
    compliance_score: number;
}

// ── Screen 8: GET /api/violations/:id ────────────────────────
export interface ViolationDetailResponse extends Violation {
    rule_accuracy?: {
        precision: number;
        recall: number;
        f1: number;
        validated_against: string;
    };
    historical_context?: {
        avg_fine?: string;
        max_fine?: string;
        breach_example?: string;
        article_reference?: string;
        total_cases?: number;
    };
    full_article_text?: any[];
}

// ── Screen 8: PATCH /api/violations/:id ──────────────────────
export interface ReviewViolationRequest {
    status: 'approved' | 'false_positive';
    review_note?: string;
}

export interface ReviewViolationResponse {
    success: boolean;
    violation: {
        id: string;
        status: string;
        reviewed_at: string;
    };
    updated_score: number;
}

// ── GET /api/compliance/score ────────────────────────────────
export interface ComplianceScoreResponse {
    score: number;
    total_violations: number;
    open_violations: number;
    resolved_violations: number;
    false_positives: number;
    by_severity: Record<string, number>;
    by_rule_type: Record<string, number>;
}

// ── GET /api/scan/history ───────────────────────────────────
export interface ScanHistoryEntry {
    id: string;
    policy_id: string;
    score: number;
    violation_count: number;
    new_violations: number;
    resolved_violations: number;
    status: string;
    created_at: string;
    audit_name?: string;
}

export interface ScanHistoryResponse {
    scans: ScanHistoryEntry[];
}

// ── GET /api/export ─────────────────────────────────────────
export interface ExportResponse {
    report: {
        generated_at: string;
        policy: { id: string; name: string };
        scan: { id: string; score: number; violation_count: number; scan_date: string };
        violations: Violation[];
        summary: {
            total_violations: number;
            high_severity: number;
            medium_severity: number;
            low_severity: number;
        };
    };
}
