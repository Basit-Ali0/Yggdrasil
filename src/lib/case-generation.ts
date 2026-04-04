// ============================================================
// Case Generation — auto-create cases after AML scan completion
// Groups violations by subject key (P3-03, P3-04, P3-05)
// ============================================================

import { v4 as uuid } from 'uuid';

export interface ViolationForCase {
    id: string;
    rule_id: string;
    rule_name: string;
    severity: string;
    account: string;
    amount: number;
    transaction_type?: string;
    record_id?: string;
    /** Counterparty / recipient extracted from evidence */
    recipient?: string;
}

export interface GeneratedCase {
    id: string;
    subject_key: string;
    subject_type: string;
    severity_rollup: string;
    violation_count: number;
    open_violations: number;
    suspicious_amount: number;
    counterparty_count: number;
    priority_score: number;
    violation_ids: string[];
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };

/**
 * Derive the subject key for grouping violations into cases.
 * Prefers `account`, then falls back to `record_id`.
 */
export function deriveSubjectKey(v: ViolationForCase): string {
    if (v.account && v.account.trim().length > 0 && v.account !== '-') {
        return v.account.trim();
    }
    return v.record_id ?? v.id;
}

function maxSeverity(violations: ViolationForCase[]): string {
    let max = 0;
    let label = 'MEDIUM';
    for (const v of violations) {
        const s = SEVERITY_ORDER[v.severity] ?? 0;
        if (s > max) {
            max = s;
            label = v.severity;
        }
    }
    return label;
}

function countCounterparties(violations: ViolationForCase[]): number {
    const set = new Set<string>();
    for (const v of violations) {
        if (v.recipient && v.recipient.trim().length > 0 && v.recipient !== '-') {
            set.add(v.recipient.trim());
        }
    }
    return set.size;
}

/**
 * Compute a priority score for ranking cases in the queue.
 * Higher = more urgent.
 */
function computePriorityScore(
    severityRollup: string,
    violationCount: number,
    suspiciousAmount: number,
    isRepeatSubject: boolean
): number {
    const severityWeight = SEVERITY_ORDER[severityRollup] ?? 1;
    const countWeight = Math.min(violationCount, 20);
    const amountWeight = Math.log10(Math.max(suspiciousAmount, 1));
    const repeatBonus = isRepeatSubject ? 5 : 0;
    return severityWeight * 10 + countWeight * 2 + amountWeight + repeatBonus;
}

/**
 * Group violations by subject and produce case records.
 * Returns cases + the mapping of violation_id → case_id.
 */
export function generateCases(
    violations: ViolationForCase[],
    existingSubjects?: Set<string>
): GeneratedCase[] {
    const groups = new Map<string, ViolationForCase[]>();

    for (const v of violations) {
        const key = deriveSubjectKey(v);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(v);
    }

    const cases: GeneratedCase[] = [];

    for (const [subjectKey, group] of groups) {
        const sevRollup = maxSeverity(group);
        const totalAmount = group.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
        const cpCount = countCounterparties(group);
        const isRepeat = existingSubjects?.has(subjectKey) ?? false;
        const priority = computePriorityScore(sevRollup, group.length, totalAmount, isRepeat);
        const subjectType = group[0].account && group[0].account.trim().length > 0 ? 'account' : 'record_id';

        cases.push({
            id: uuid(),
            subject_key: subjectKey,
            subject_type: subjectType,
            severity_rollup: sevRollup,
            violation_count: group.length,
            open_violations: group.length,
            suspicious_amount: totalAmount,
            counterparty_count: cpCount,
            priority_score: priority,
            violation_ids: group.map((v) => v.id),
        });
    }

    cases.sort((a, b) => b.priority_score - a.priority_score);
    return cases;
}

/**
 * Check if a policy type is AML (cases are only generated for AML scans).
 */
export function isAmlPolicyType(policyType: string | null | undefined): boolean {
    return policyType === 'aml';
}
