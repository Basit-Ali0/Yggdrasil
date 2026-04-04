// ============================================================
// Frontend Contracts — Yggdrasil
// Matches CONTRACTS.md exactly for screen transitions
// ============================================================

import type { Rule, Violation, ClarificationQuestion } from './types';
import type { RawExtractedRule } from './validators/extracted-policy-rules';

// ── Audit lifecycle types ────────────────────────────────────
export type AuditStatus = 'draft' | 'ready_to_scan' | 'scan_running' | 'completed' | 'failed';

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

/** GET /api/audits/:id */
export interface AuditDetailResponse {
    id: string;
    name: string;
    status: AuditStatus;
    organization_id: string | null;
    data_source: string;
    connector_id: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    policy: { id: string; name: string; type: string; prebuilt_type?: string; rules_count: number } | null;
    upload: { id: string; file_name: string; row_count: number; created_at: string } | null;
    mapping: { id: string; ready: boolean } | null;
    latest_scan: { id: string; status: string; score: number; violation_count: number; created_at: string; completed_at: string | null } | null;
    can_rescan: boolean;
}

/** GET /api/audits */
export interface AuditListResponse {
    audits: Array<{
        id: string;
        name: string;
        status: AuditStatus;
        policy_id: string | null;
        data_source: string;
        created_at: string;
        updated_at: string;
        latest_scan_id: string | null;
    }>;
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

// ── POST /api/data/mapping/readiness ───────────────────────
export type MappingReadinessState = 'ready' | 'warning' | 'blocked';

export interface MappingReadinessRuleDependency {
    rule_id: string;
    rule_name: string;
    is_active: boolean;
    required_fields: string[];
}

export interface MappingReadinessResponse {
    state: MappingReadinessState;
    missing_required: string[];
    invalid_columns: string[];
    warnings: string[];
    required_fields: string[];
    rule_dependencies: MappingReadinessRuleDependency[];
    sample_normalized_rows: Record<string, unknown>[];
}

/** Per-rule engine validation (ingest, add-pdf, generate-rules). */
export interface RuleValidationIssue {
    category: string;
    message: string;
    path?: string;
}

export interface RuleValidationEntry {
    rule_id: string;
    valid: boolean;
    issues: RuleValidationIssue[];
}

export interface PolicyWithRulesPayload {
    id: string;
    name: string;
    rules: RawExtractedRule[];
    created_at: string;
}

export interface PolicyExtractResponse {
    policy: PolicyWithRulesPayload;
    rule_validation: RuleValidationEntry[];
}

/** POST /api/policies/:id/rules/add-pdf */
export interface PolicyAddPdfRulesResponse {
    added_count: number;
    /** Rules that passed engine validation and are active. */
    inserted_valid: number;
    /** Rules inserted but quarantined (is_active: false) due to validation issues. */
    inserted_quarantined: number;
    /** Rules skipped because an identical rule (same normalized identity key) already exists. */
    skipped_count: number;
    skipped_rule_ids: string[];
    rules: RawExtractedRule[];
    rule_validation?: RuleValidationEntry[];
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
    status: 'running' | 'completed';
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
        organization: { id: string; name: string } | null;
        audit: { id: string; name: string } | null;
        policy: { id: string; name: string; type: string; rules_count: number };
        scan: {
            id: string;
            status: string;
            compliance_score: number;
            record_count: number;
            violation_count: number;
            created_at: string;
            completed_at: string | null;
        };
        violations: Violation[];
        reviews: {
            total: number;
            approved: number;
            false_positive: number;
            disputed: number;
            pending: number;
            notes: Array<{
                violation_id: string;
                status: string;
                note: string;
                reviewed_by: string;
                reviewed_at: string;
            }>;
        };
        summary: {
            total_violations: number;
            by_severity: Record<string, number>;
            by_rule: Array<{ rule_id: string; rule_name: string; count: number }>;
        };
    };
}

// ── Connector types ─────────────────────────────────────────
export type ConnectorType = 'postgres' | 's3_csv';

export interface Connector {
    id: string;
    name: string;
    type: ConnectorType;
    config: Record<string, unknown>;
    status: 'active' | 'disabled' | 'error';
    last_tested_at: string | null;
    created_at: string;
}

export interface ConnectorListResponse {
    connectors: Connector[];
}

export interface ConnectorTestResponse {
    ok: boolean;
    error?: string;
    message?: string;
}

export interface ConnectorDiscoverResponse {
    schemas?: Array<{ name: string; tables: string[] }>;
    files?: Array<{ key: string; size: number; last_modified: string | null }>;
}

export interface ConnectorPreviewResponse {
    headers: string[];
    rows: Record<string, unknown>[];
    total_rows?: number;
    preview_rows: number;
}

export interface ConnectorImportResponse {
    upload_id: string;
    row_count: number;
    headers: string[];
    file_name: string;
    source: string;
    connector_id: string;
}
