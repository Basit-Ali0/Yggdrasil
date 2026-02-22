// ============================================================
// InMemoryBackend — Deterministic rule enforcement
// Supports AML, GDPR, SOC2, and custom PDF-extracted rules
// Hour-0 Bug #1: ROUND_AMOUNT uses (x % 1000) === 0
// Hour-0 Bug #3: Pre-filter records to amount >= 8000
// Routes windowed rules by rule.type (NOT rule.timeWindow)
// ============================================================

import { v4 as uuid } from 'uuid';
import { Rule, NormalizedRecord, WINDOWED_RULE_TYPES } from '../types';
import { normalizeTime, getWindowKey } from './temporal';
import {
    generateExplanation,
    generateWindowedExplanation,
} from './explainability';

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
    confidence?: number;
}

/**
 * Pre-filter records to amount >= 8000 per RuleEngine.md hard rule.
 * This is applied before passing to windowed rules that operate on
 * sub-threshold amounts ($8K–$10K). Single-tx rules like CTR_THRESHOLD
 * get the full dataset because they have their own threshold checks.
 */
function preFilterForSubThreshold(records: NormalizedRecord[]): NormalizedRecord[] {
    return records.filter((r) => r.amount >= 8000);
}

/**
 * Check if an amount is a round dollar amount.
 * Hour-0 Bug #1 fix: (x % 1000) === 0 — nothing else.
 */
function isRoundAmount(x: number): boolean {
    return x % 1000 === 0;
}

/**
 * Coerce equality comparison for CSV string values vs typed rule values.
 * CSV always produces strings; rules define booleans/numbers.
 * "false" should equal false, "16" should equal 16, etc.
 */
function coerceEquals(left: any, right: any): boolean {
    // Same type — direct comparison
    if (typeof left === typeof right) return left === right;

    // Rule value is boolean, CSV value is string
    if (typeof right === 'boolean' && typeof left === 'string') {
        return (left.toLowerCase() === 'true') === right;
    }

    // Rule value is number, CSV value is string
    if (typeof right === 'number' && typeof left === 'string') {
        return parseFloat(left) === right;
    }

    // Rule value is string, CSV value is number/boolean
    if (typeof left === 'boolean' && typeof right === 'string') {
        return left === (right.toLowerCase() === 'true');
    }
    if (typeof left === 'number' && typeof right === 'string') {
        return left === parseFloat(right);
    }

    // Fallback: loose equality
    // eslint-disable-next-line eqeqeq
    return left == right;
}

export class InMemoryBackend {
    name = 'in-memory';

    execute(
        rule: Rule,
        records: NormalizedRecord[],
        temporalScale: number
    ): ViolationResult[] {
        const isWindowed = (WINDOWED_RULE_TYPES as readonly string[]).includes(rule.type);

        if (isWindowed) {
            return this.executeWindowed(rule, records, temporalScale);
        } else {
            return this.executeSingleTx(rule, records);
        }
    }

    // ── Single-transaction rules ─────────────────────────────

    private executeSingleTx(
        rule: Rule,
        records: NormalizedRecord[]
    ): ViolationResult[] {
        const violations: ViolationResult[] = [];

        for (const record of records) {
            if (this.checkSingleTxRule(rule, record)) {
                violations.push(this.createViolation(rule, record));
            }
        }

        return violations;
    }

    private checkSingleTxRule(rule: Rule, record: NormalizedRecord): boolean {
        // All rules now go through generic condition checker
        return this.checkConditions(rule, record);
    }

    private checkConditions(rule: Rule, record: NormalizedRecord): boolean {
        const cond = rule.conditions;
        if (!cond) return false;
        
        return this.evaluateLogic(cond, record);
    }

    private evaluateLogic(cond: any, record: NormalizedRecord): boolean {
        // Handle recursive compound conditions
        if ('AND' in cond && Array.isArray(cond.AND)) {
            return (cond.AND as any[]).every(c => this.evaluateLogic(c, record));
        }
        if ('OR' in cond && Array.isArray(cond.OR)) {
            return (cond.OR as any[]).some(c => this.evaluateLogic(c, record));
        }
        
        // Handle simple condition
        if ('field' in cond) {
            return this.checkSingleCondition(cond as any, record);
        }
        
        return false;
    }

    private checkSingleCondition(cond: { field: string; operator: string; value: any; value_type?: string }, record: NormalizedRecord): boolean {
        const leftValue = record[cond.field];
        let rightValue = cond.value;

        // Normalize operator aliases from Gemini LLM output
        const op = this.normalizeOperator(cond.operator);

        // Handle existence operators BEFORE null check — they test for field presence/absence
        if (op === 'EXISTS') {
            return leftValue !== undefined && leftValue !== null && leftValue !== '';
        }
        if (op === 'NOT_EXISTS') {
            return leftValue === undefined || leftValue === null || leftValue === '';
        }

        // SANITY CHECK: If field is missing or undefined, don't match (prevents massive false positives)
        if (leftValue === undefined || leftValue === null) {
            return false;
        }

        // Support cross-field comparison
        if (cond.value_type === 'field' && typeof rightValue === 'string') {
            rightValue = record[rightValue];
            if (rightValue === undefined || rightValue === null) return false;
        }

        switch (op) {
            // Numeric comparisons — parseFloat handles CSV string values
            case '>=':
                return parseFloat(leftValue) >= parseFloat(rightValue);
            case '>':
                return parseFloat(leftValue) > parseFloat(rightValue);
            case '<=':
                return parseFloat(leftValue) <= parseFloat(rightValue);
            case '<':
                return parseFloat(leftValue) < parseFloat(rightValue);

            // Equality — with type coercion for CSV string values
            case '==':
                return coerceEquals(leftValue, rightValue);
            case '!=':
                return !coerceEquals(leftValue, rightValue);

            // Set membership
            case 'IN':
                return Array.isArray(rightValue) && rightValue.includes(leftValue);
            case 'BETWEEN':
                return (
                    Array.isArray(rightValue) &&
                    (leftValue as number) >= rightValue[0] &&
                    (leftValue as number) <= rightValue[1]
                );

            // String matching
            case 'CONTAINS':
                return typeof leftValue === 'string' && typeof rightValue === 'string' &&
                    leftValue.toLowerCase().includes(rightValue.toLowerCase());
            case 'MATCH':
                if (typeof leftValue === 'string' && typeof rightValue === 'string') {
                    return new RegExp(rightValue).test(leftValue);
                }
                return false;

            default:
                console.warn(`[ENGINE] Unknown operator: '${cond.operator}' in rule condition for field '${cond.field}'`);
                return false;
        }
    }

    /**
     * Map common operator aliases from Gemini LLM output to engine-standard operators.
     */
    private normalizeOperator(op: string): string {
        const normalized = op.trim().toLowerCase();
        const map: Record<string, string> = {
            // Standard
            '>=': '>=', '>': '>', '<=': '<=', '<': '<',
            '==': '==', '!=': '!=', 'in': 'IN', 'between': 'BETWEEN',
            // Gemini aliases
            'equals': '==', 'equal': '==', 'eq': '==',
            'not_equals': '!=', 'not_equal': '!=', 'neq': '!=', 'ne': '!=',
            'greater_than': '>', 'gt': '>',
            'greater_than_or_equal': '>=', 'gte': '>=',
            'less_than': '<', 'lt': '<',
            'less_than_or_equal': '<=', 'lte': '<=',
            'exists': 'EXISTS', 'not_exists': 'NOT_EXISTS',
            'contains': 'CONTAINS', 'includes': 'CONTAINS',
            'match': 'MATCH', 'regex': 'MATCH',
        };
        return map[normalized] || op;
    }

    // ── Windowed rules ───────────────────────────────────────

    private executeWindowed(
        rule: Rule,
        records: NormalizedRecord[],
        temporalScale: number
    ): ViolationResult[] {
        // Group by account
        const grouped = this.groupByAccount(records);
        const violations: ViolationResult[] = [];

        for (const [account, accountRecords] of grouped) {
            const results = this.checkWindowedRule(
                rule,
                account,
                accountRecords,
                temporalScale
            );
            violations.push(...results);
        }

        return violations;
    }

    private groupByAccount(
        records: NormalizedRecord[]
    ): Map<string, NormalizedRecord[]> {
        const groups = new Map<string, NormalizedRecord[]>();

        for (const record of records) {
            const account = record.account;
            if (!account) continue;

            if (!groups.has(account)) {
                groups.set(account, []);
            }
            groups.get(account)!.push(record);
        }

        return groups;
    }

    private checkWindowedRule(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        temporalScale: number
    ): ViolationResult[] {
        switch (rule.type) {
            case 'aggregation':
            case 'ctr_aggregation':
                return this.checkAggregation(rule, account, records, temporalScale);
            case 'velocity':
            case 'velocity_limit':
            case 'sar_velocity':
            case 'sub_threshold_velocity':
            case 'structuring':
                return this.checkVelocity(rule, account, records, temporalScale);
            case 'dormant_reactivation':
                return this.checkDormantReactivation(
                    rule,
                    account,
                    records,
                    temporalScale
                );
            case 'round_amount':
                return this.checkRoundAmount(rule, account, records, temporalScale);
            case 'behavioral':
                // For behavioral, we treat it as single tx but with history context
                return this.executeSingleTx(rule, records);
            default:
                return [];
        }
    }

    private checkAggregation(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        const violations: ViolationResult[] = [];
        const window = rule.time_window || 24;
        const groupBy = rule.group_by_field || 'recipient';
        const aggField = rule.aggregation_field || 'amount';
        const aggFunc = rule.aggregation_function || 'sum';
        const threshold = rule.threshold || 0;

        // Group by (groupByField, window)
        const windows = new Map<string, NormalizedRecord[]>();
        for (const r of records) {
            const timeKey = getWindowKey(r.step, window, scale);
            const groupVal = r[groupBy] || 'unknown';
            const key = `${groupVal}_${timeKey}`;
            if (!windows.has(key)) windows.set(key, []);
            windows.get(key)!.push(r);
        }

        for (const [key, txns] of windows) {
            let actualValue = 0;
            const values = txns.map(t => t[aggField] as number).filter(v => typeof v === 'number');

            if (aggFunc === 'sum') actualValue = values.reduce((a, b) => a + b, 0);
            else if (aggFunc === 'count') actualValue = values.length;
            else if (aggFunc === 'avg') actualValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            else if (aggFunc === 'max') actualValue = values.length > 0 ? Math.max(...values) : 0;
            else if (aggFunc === 'min') actualValue = values.length > 0 ? Math.min(...values) : 0;

            // Special case for legacy CTR Aggregation
            const isLegacyCtr = rule.rule_id === 'CTR_AGGREGATION' && txns.length > 1;
            const meetsThreshold = actualValue >= threshold;

            if (meetsThreshold && (rule.type === 'aggregation' || isLegacyCtr || txns.length > 1)) {
                violations.push(
                    this.createWindowedViolation(rule, account, txns, {
                        actual_value: actualValue,
                        threshold,
                        group_value: key.split('_')[0],
                    })
                );
            }
        }

        return violations;
    }

    private checkVelocity(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        const violations: ViolationResult[] = [];
        const window = rule.time_window || 24;
        const threshold = rule.threshold || 1;
        
        // Velocity usually implies COUNT or SUM over window
        // For PaySim AML, we had special filters for structuring
        let filtered = records;
        if (rule.rule_id === 'STRUCTURING_PATTERN' || rule.rule_id === 'SUB_THRESHOLD_VELOCITY') {
            filtered = preFilterForSubThreshold(records).filter(r => r.amount < 10000);
        }

        const windows = new Map<number, NormalizedRecord[]>();
        for (const r of filtered) {
            const wk = getWindowKey(r.step, window, scale);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }

        for (const [, txns] of windows) {
            const count = txns.length;
            const sum = txns.reduce((s, r) => s + r.amount, 0);
            
            let triggered = false;
            let actualValue = count;

            if (rule.type === 'velocity' || rule.type === 'velocity_limit' || rule.type === 'sub_threshold_velocity' || rule.type === 'structuring') {
                triggered = count >= threshold;
                actualValue = count;
            } else if (rule.type === 'sar_velocity') {
                triggered = sum > (rule.threshold || 25000);
                actualValue = sum;
            }

            if (triggered) {
                violations.push(
                    this.createWindowedViolation(rule, account, txns, {
                        actual_value: actualValue,
                        threshold: rule.threshold || threshold,
                    })
                );
            }
        }

        return violations;
    }

    // ── DORMANT_ACCOUNT_REACTIVATION ───────────────────────────
    // No transactions > $100 in 90 steps, then > $5000 within 30 steps

    private checkDormantReactivation(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        if (records.length < 2) return [];
        const violations: ViolationResult[] = [];

        // Sort by step
        const sorted = [...records].sort((a, b) => a.step - b.step);

        // Find gaps: look for 90-step dormancy (scaled)
        const dormancyThreshold = 90 * (scale === 24 ? 1 : scale); // 90 days in steps
        const reactivationWindow = 30 * (scale === 24 ? 1 : scale);

        for (let i = 1; i < sorted.length; i++) {
            const gap = sorted[i].step - sorted[i - 1].step;
            if (gap >= dormancyThreshold && sorted[i].amount > 5000) {
                // Check if within reactivation window
                const daysDormant = Math.round(gap * (scale === 24 ? 1 : 1));
                violations.push(
                    this.createWindowedViolation(rule, account, [sorted[i]], {
                        actual_value: sorted[i].amount,
                        threshold: 5000,
                        amount: sorted[i].amount,
                        daysDormant,
                        daysSince: 1,
                    })
                );
            }
        }

        return violations;
    }

    // ── ROUND_AMOUNT_PATTERN ───────────────────────────────────
    // 3+ round-dollar transactions within 30 days (720 * scale steps)
    // Hour-0 Bug #1 fix: is_round(x) = (x % 1000) === 0

    private checkRoundAmount(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        const roundRecords = records.filter((r) => isRoundAmount(r.amount));
        if (roundRecords.length < 3) return [];

        const violations: ViolationResult[] = [];

        // Window: 30 days = 720 hours
        const windowHours = 720;

        const windows = new Map<number, NormalizedRecord[]>();
        for (const r of roundRecords) {
            const wk = getWindowKey(r.step, windowHours, scale);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }

        for (const [, txns] of windows) {
            if (txns.length >= 3) {
                violations.push(
                    this.createWindowedViolation(rule, account, txns, {
                        actual_value: txns.length,
                        threshold: 3,
                    })
                );
            }
        }

        return violations;
    }

    // ── Violation Builders ─────────────────────────────────────

    /**
     * Extract the primary condition match from a rule for display purposes.
     * For financial rules with thresholds, returns threshold vs amount.
     * For condition-based rules (GDPR/SOC2), returns the first leaf condition's
     * expected value vs the actual record value.
     */
    private extractConditionMatch(
        rule: Rule,
        record: NormalizedRecord
    ): { threshold: number; actual_value: number; condition_summary?: string } {
        // If rule has an explicit numeric threshold, use financial comparison
        if (rule.threshold != null && rule.threshold > 0) {
            return { threshold: rule.threshold, actual_value: record.amount };
        }

        // For condition-based rules, extract the first leaf condition for display
        const cond = rule.conditions;
        if (cond) {
            const leaf = this.findFirstLeafCondition(cond);
            if (leaf) {
                const actualVal = record[leaf.field];
                const expectedVal = leaf.value;
                // Build a human-readable summary depending on operator type
                let summary: string;
                if (leaf.operator === 'exists') {
                    summary = `${leaf.field} is present (value: ${JSON.stringify(actualVal)})`;
                } else if (leaf.operator === 'not_exists') {
                    summary = `${leaf.field} is missing or empty`;
                } else {
                    summary = `${leaf.field} ${leaf.operator} ${JSON.stringify(expectedVal)} (actual: ${JSON.stringify(actualVal)})`;
                }
                // Store as numbers if possible, otherwise use 0 placeholders —
                // the evidence drawer will use condition_summary for display
                return {
                    threshold: typeof expectedVal === 'number' ? expectedVal : 0,
                    actual_value: typeof actualVal === 'number' ? actualVal : 0,
                    condition_summary: summary,
                };
            }
        }

        return { threshold: 0, actual_value: record.amount };
    }

    private findFirstLeafCondition(cond: any): { field: string; operator: string; value: any } | null {
        if ('field' in cond) return cond;
        if ('AND' in cond && Array.isArray(cond.AND) && cond.AND.length > 0) {
            return this.findFirstLeafCondition(cond.AND[0]);
        }
        if ('OR' in cond && Array.isArray(cond.OR) && cond.OR.length > 0) {
            return this.findFirstLeafCondition(cond.OR[0]);
        }
        return null;
    }

    private createViolation(
        rule: Rule,
        record: NormalizedRecord
    ): ViolationResult {
        const match = this.extractConditionMatch(rule, record);

        return {
            id: uuid(),
            rule_id: rule.rule_id,
            rule_name: rule.name,
            severity: rule.severity,
            record_id: `${record.step}_${record.account}`,
            account: record.account,
            amount: record.amount,
            transaction_type: record.type,
            evidence: {
                ...record,
                ...(match.condition_summary ? { condition_summary: match.condition_summary } : {}),
            },
            threshold: match.threshold,
            actual_value: match.actual_value,
            policy_excerpt: rule.policy_excerpt,
            policy_section: rule.policy_section ?? '',
            explanation: generateExplanation(rule, record),
            status: 'pending',
        };
    }

    private createWindowedViolation(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        extras: Record<string, any> = {}
    ): ViolationResult {
        const total = records.reduce((sum, r) => sum + r.amount, 0);

        return {
            id: uuid(),
            rule_id: rule.rule_id,
            rule_name: rule.name,
            severity: rule.severity,
            record_id: `${account}_${rule.rule_id}_${records[0]?.step ?? 0}`,
            account,
            amount: total,
            transaction_type: records[0]?.type ?? '',
            evidence: {
                account,
                transaction_count: records.length,
                amounts: records.map((r) => r.amount),
                records: records.slice(0, 10), // limit evidence size
            },
            threshold: extras.threshold ?? rule.threshold ?? 0,
            actual_value: extras.actual_value ?? total,
            policy_excerpt: rule.policy_excerpt,
            policy_section: rule.policy_section ?? '',
            explanation: generateWindowedExplanation(rule, account, records, extras),
            status: 'pending',
        };
    }
}
