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
    policy_type?: 'aml' | 'gdpr' | 'soc2' | 'pdf';
    policy_id?: string;
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
        connector_id?: string | null;
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
    /** AML only: number of investigation cases auto-created */
    cases_created?: number;
    /** AML only: number of unique subjects flagged */
    subjects_flagged?: number;
}

// ── Screen 6 polling: GET /api/scan/:id ──────────────────────
export interface ScanDelta {
    new_count: number;
    resolved_count: number;
    unchanged_count: number;
    previous_scan_id: string;
    previous_violation_count: number;
}

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
    data_source?: string;
    file_name?: string | null;
    score_history?: Array<{
        score: number;
        timestamp: string;
        action: string;
        violation_id?: string | null;
    }>;
    record_count?: number;
    // Rescan fields
    policy_id?: string;
    upload_id?: string;
    mapping_id?: string;
    audit_id?: string;
    mapping_config?: Record<string, string>;
    temporal_scale?: number;
    // Delta fields
    delta?: ScanDelta | null;
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
        status: 'pending' | 'approved' | 'false_positive' | 'disputed';
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
    unchanged_count: number;
    status: string;
    created_at: string;
    audit_name?: string;
    data_source?: string;
    connector_id?: string | null;
    file_name?: string | null;
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
    import_limit?: number;
    truncated?: boolean;
}

export interface CreateConnectorRequest {
    name: string;
    type: ConnectorType;
    config: Record<string, unknown>;
    credentials?: Record<string, unknown>;
}

export interface UpdateConnectorRequest {
    name?: string;
    config?: Record<string, unknown>;
    status?: 'active' | 'disabled' | 'error';
}

export interface ConnectorImportSelection {
    connector_id: string;
    table?: string;
    key?: string;
    audit_id?: string;
}

// ── Organization member types ─────────────────────────────────────────
export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface OrganizationSummary {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    role: OrganizationRole;
    member_count: number;
}

export interface OrganizationCurrentResponse {
    organization: OrganizationSummary | null;
    role: OrganizationRole | null;
    organizations: OrganizationSummary[];
    selected_organization_id: string | null;
    message?: string;
}

export interface OrganizationListResponse {
    organizations: OrganizationSummary[];
}

export interface CreateOrganizationRequest {
    name: string;
    slug?: string;
}

export interface CreateOrganizationResponse {
    organization: OrganizationSummary;
    role: OrganizationRole;
}

export interface OrganizationMember {
    id: string;
    organization_id: string;
    user_id: string;
    email: string | null;
    role: OrganizationRole;
    created_at: string;
    is_current_user?: boolean;
    can_remove?: boolean;
    can_change_role?: boolean;
    is_last_owner?: boolean;
}

export interface OrganizationMembersResponse {
    members: OrganizationMember[];
}

export interface AddOrganizationMemberRequest {
    email: string;
    role: OrganizationRole;
}

export interface UpdateOrganizationMemberRequest {
    role: OrganizationRole;
}

export interface OrganizationInvitation {
    id: string;
    email: string;
    role: OrganizationRole;
    status: 'pending' | 'accepted' | 'revoked' | 'expired';
    expires_at: string;
    created_at: string;
    invited_by_email: string | null;
}

export interface OrganizationInvitationsResponse {
    invitations: OrganizationInvitation[];
}

export interface CreateInvitationRequest {
    email: string;
    role: OrganizationRole;
}

export interface CreateInvitationResponse {
    invitation: OrganizationInvitation;
    invite_url: string;
}

export interface InvitationPreviewResponse {
    invitation: {
        organization_id: string;
        organization_name: string;
        email: string;
        role: OrganizationRole;
        status: string;
        expires_at: string;
        created_at: string;
    } | null;
}

export interface AcceptInvitationRequest {
    token: string;
}

export interface AcceptInvitationResponse {
    organization: OrganizationSummary;
    role: OrganizationRole;
}

export interface OrganizationEvent {
    id: string;
    event_type: string;
    actor_email: string | null;
    target_email: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface OrganizationEventsResponse {
    events: OrganizationEvent[];
}

// ── Policy library types ──────────────────────────────────────────────
export interface PolicyListItem {
    id: string;
    name: string;
    type: string;
    prebuilt_type: string | null;
    rules_count: number;
    active_rule_count: number;
    invalid_rule_count: number;
    validation_status: 'valid' | 'has_invalid_rules';
    status: string;
    created_at: string;
    updated_at: string;
}

export interface PolicyListResponse {
    policies: PolicyListItem[];
}

// ── Case types (P3) ─────────────────────────────────────────
export type CaseStatus = 'open' | 'in_review' | 'escalated' | 'closed_no_action' | 'sar_prepared';
export type CaseDisposition = 'false_positive' | 'monitor' | 'investigate_further' | 'prepare_sar' | 'closed';

export interface Case {
    id: string;
    organization_id: string | null;
    audit_id: string | null;
    scan_id: string;
    policy_id: string | null;
    subject_key: string;
    subject_type: string;
    status: CaseStatus;
    disposition: CaseDisposition | null;
    owner_id: string | null;
    narrative: string | null;
    priority_score: number;
    severity_rollup: string;
    violation_count: number;
    open_violations: number;
    suspicious_amount: number;
    counterparty_count: number;
    latest_activity: string;
    assigned_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CaseEvent {
    id: string;
    case_id: string;
    event_type: string;
    actor_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
}

export interface CaseListResponse {
    cases: Case[];
    total: number;
    limit: number;
    offset: number;
}

export interface CaseDetailResponse extends Case {
    violations: Violation[];
    timeline: CaseEvent[];
    prior_cases: Array<{
        id: string;
        scan_id: string;
        status: string;
        severity_rollup: string;
        violation_count: number;
        suspicious_amount: number;
        created_at: string;
    }>;
    grouped_evidence: Array<{
        rule_id: string;
        rule_name: string;
        count: number;
        total_amount: number;
    }>;
    review_summary: {
        total: number;
        pending: number;
        approved: number;
        false_positive: number;
    };
    sar_ready: boolean;
}

export interface CaseExportResponse {
    case_packet: {
        generated_at: string;
        organization: { id: string; name: string } | null;
        case: Omit<Case, 'organization_id'>;
        sar_prep: {
            narrative: string | null;
            date_range_start: string | null;
            date_range_end: string | null;
            flagged_amount: number;
            involved_accounts: string[];
            counterparties: string[];
            analyst_summary: string | null;
            supporting_triggers: Array<{ rule_id: string; rule_name: string; count: number }>;
        };
        violations: Violation[];
        notes: Array<{ content: string; actor_id: string; created_at: string }>;
        timeline: CaseEvent[];
        summary: {
            total_violations: number;
            suspicious_amount: number;
            by_severity: Record<string, number>;
            by_rule: Array<{ rule_id: string; rule_name: string; count: number; total_amount: number }>;
        };
    };
}
