// ============================================================
// ViolationResult — engine output shape (DB + API mapping)
// ============================================================

export interface ViolationResult {
    id: string;
    rule_id: string;
    rule_name: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    record_id: string;
    account: string;
    amount: number;
    transaction_type: string;
    evidence: Record<string, any>;
    threshold: number;
    actual_value: number;
    policy_excerpt: string;
    policy_section: string;
    explanation: string;
    status: 'pending';
}
