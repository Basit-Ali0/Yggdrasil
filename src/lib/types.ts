// ============================================================
// PolicyGuard AI — Core TypeScript Types
// Matches CONTRACTS.md shared types exactly
// ============================================================

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

// ── Rule ─────────────────────────────────────────────────────
export interface Rule {
    rule_id: string;        // "CTR_THRESHOLD"
    name: string;           // "Currency Transaction Report Threshold"
    type: string;           // "ctr_threshold"
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    threshold: number | null;
    time_window: number | null;
    conditions: RuleCondition;
    policy_excerpt: string;
    policy_section: string;
    is_active: boolean;
    description?: string;
}

export interface RuleCondition {
    field: string;
    operator: string;
    value: any;
}

// ── Violation ────────────────────────────────────────────────
export interface Violation {
    id: string;
    scan_id: string;
    rule_id: string;
    rule_name: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    account: string;
    amount: number;
    transaction_type?: string;
    evidence: Record<string, any>;
    threshold: number;
    actual_value: number;
    policy_excerpt: string;
    policy_section?: string;
    explanation: string;
    status: 'pending' | 'approved' | 'false_positive' | 'disputed';
    review_note?: string | null;
    reviewed_at?: string | null;
    reviewed_by?: string | null;
    created_at?: string;
    record_id?: string;
}

// ── Scan ─────────────────────────────────────────────────────
export interface Scan {
    id: string;
    user_id: string;
    policy_id: string;
    temporal_scale: number;
    mapping_config: Record<string, string>;
    data_source: string;
    file_name: string | null;
    record_count: number;
    violation_count: number;
    compliance_score: number | null;
    status: 'pending' | 'running' | 'completed' | 'failed';
    created_at: string;
    completed_at: string | null;
    rules_processed?: number;
    rules_total?: number;
}

// ── Clarification Question ───────────────────────────────────
export interface ClarificationQuestion {
    question_id: string;
    question: string;
    options: string[];
}

// ── Validation Metrics ───────────────────────────────────────
export interface ValidationMetrics {
    precision: number;
    recall: number;
    f1: number;
    fpr: number;
    tp: number;
    fp: number;
    fn: number;
    tn: number;
    summary: string;
    validated_against: string;
    total_labeled: number;
}

// ── Normalized Transaction Record ────────────────────────────
export interface NormalizedRecord {
    account: string;
    recipient: string;
    amount: number;
    step: number;
    type: string;
    oldbalanceOrg?: number;
    newbalanceOrig?: number;
    oldbalanceDest?: number;
    newbalanceDest?: number;
    [key: string]: any;   // preserve extra fields (ground truth labels, etc.)
}

// ── Dataset type detection ───────────────────────────────────
export type DatasetType = 'IBM_AML' | 'PAYSIM' | 'GENERIC';

// ── Execution Config ─────────────────────────────────────────
export interface ExecutionConfig {
    temporalScale: number;  // 1.0 or 24.0
    sampleLimit: number;    // e.g. 50000
    columnMapping: Record<string, string>;
}

// ── Severity Weights for score calculation ───────────────────
export const SEVERITY_WEIGHTS: Record<string, number> = {
    CRITICAL: 1.0,
    HIGH: 0.75,
    MEDIUM: 0.5,
};

// ── Windowed Rule Types ──────────────────────────────────────
// Route by rule.type, NOT rule.timeWindow
export const WINDOWED_RULE_TYPES = [
    'structuring',
    'velocity_limit',
    'sar_velocity',
    'ctr_aggregation',
    'sub_threshold_velocity',
    'dormant_reactivation',
    'round_amount',
] as const;
