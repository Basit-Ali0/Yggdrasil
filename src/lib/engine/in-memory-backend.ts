// ============================================================
// InMemoryBackend — Deterministic rule enforcement
// All 11 AML rules from enforcement-spec.md
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
        switch (rule.rule_id) {
            case 'CTR_THRESHOLD':
                return (
                    record.amount >= 10000 &&
                    ['WIRE', 'CASH_OUT', 'TRANSFER', 'DEPOSIT', 'CASH_IN'].includes(
                        record.type.toUpperCase()
                    )
                );

            case 'SAR_THRESHOLD':
                return (
                    record.amount >= 5000 &&
                    ['WIRE', 'TRANSFER'].includes(record.type.toUpperCase())
                );

            case 'BALANCE_MISMATCH': {
                if (
                    record.oldbalanceOrg === undefined ||
                    record.newbalanceOrig === undefined
                )
                    return false;
                const expectedAfterSend = record.oldbalanceOrg - record.amount;
                return Math.abs(expectedAfterSend - record.newbalanceOrig) > 0.01;
            }

            case 'FRAUD_INDICATOR':
                return (
                    ['CASH_OUT', 'TRANSFER'].includes(record.type.toUpperCase()) &&
                    record.oldbalanceDest === 0 &&
                    (record.newbalanceDest ?? 0) > 0
                );

            case 'HIGH_VALUE_TRANSFER':
                return (
                    ['WIRE', 'TRANSFER'].includes(record.type.toUpperCase()) &&
                    record.amount > 50000
                );

            default:
                // Generic condition check
                return this.checkConditions(rule, record);
        }
    }

    private checkConditions(rule: Rule, record: NormalizedRecord): boolean {
        const cond = rule.conditions;
        if (!cond || !cond.field) return false;
        const value = record[cond.field];

        // Normalize operator aliases from Gemini LLM output
        const op = this.normalizeOperator(cond.operator);

        switch (op) {
            case '>=':
                return (value as number) >= (cond.value as number);
            case '>':
                return (value as number) > (cond.value as number);
            case '<=':
                return (value as number) <= (cond.value as number);
            case '<':
                return (value as number) < (cond.value as number);
            case '==':
                // eslint-disable-next-line eqeqeq
                return value == cond.value;
            case '!=':
                // eslint-disable-next-line eqeqeq
                return value != cond.value;
            case 'IN':
                return Array.isArray(cond.value) && cond.value.includes(value);
            case 'BETWEEN':
                return (
                    Array.isArray(cond.value) &&
                    (value as number) >= cond.value[0] &&
                    (value as number) <= cond.value[1]
                );
            case 'EXISTS':
                return value !== undefined && value !== null && value !== '';
            case 'NOT_EXISTS':
                return value === undefined || value === null || value === '';
            case 'CONTAINS':
                return typeof value === 'string' && typeof cond.value === 'string' &&
                    value.toLowerCase().includes(cond.value.toLowerCase());
            default:
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
            case 'ctr_aggregation':
                return this.checkCtrAggregation(rule, account, records, temporalScale);
            case 'structuring':
                return this.checkStructuring(rule, account, records, temporalScale);
            case 'sub_threshold_velocity':
                return this.checkSubThresholdVelocity(
                    rule,
                    account,
                    records,
                    temporalScale
                );
            case 'sar_velocity':
                return this.checkSarVelocity(rule, account, records, temporalScale);
            case 'dormant_reactivation':
                return this.checkDormantReactivation(
                    rule,
                    account,
                    records,
                    temporalScale
                );
            case 'round_amount':
                return this.checkRoundAmount(rule, account, records, temporalScale);
            default:
                return [];
        }
    }

    // ── CTR_AGGREGATION ────────────────────────────────────────
    // Group by sender+receiver per 24h window, flag if SUM >= 10000

    private checkCtrAggregation(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        const violations: ViolationResult[] = [];

        // Group by (recipient, day-window)
        const pairWindows = new Map<string, NormalizedRecord[]>();
        for (const r of records) {
            const dayKey = getWindowKey(r.step, 24, scale);
            const key = `${r.recipient}_${dayKey}`;
            if (!pairWindows.has(key)) pairWindows.set(key, []);
            pairWindows.get(key)!.push(r);
        }

        for (const [key, txns] of pairWindows) {
            const total = txns.reduce((s, r) => s + r.amount, 0);
            if (total >= 10000 && txns.length > 1) {
                violations.push(
                    this.createWindowedViolation(rule, account, txns, {
                        actual_value: total,
                        threshold: 10000,
                        recipient: txns[0].recipient,
                    })
                );
            }
        }

        return violations;
    }

    // ── STRUCTURING_PATTERN ────────────────────────────────────
    // 3+ transactions $8K–$10K within 24 hours

    private checkStructuring(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        // Pre-filter to sub-threshold amounts
        const filtered = preFilterForSubThreshold(records).filter(
            (r) => r.amount < 10000
        );
        if (filtered.length < 3) return [];

        const violations: ViolationResult[] = [];

        // Group by 24h window
        const windows = new Map<number, NormalizedRecord[]>();
        for (const r of filtered) {
            const wk = getWindowKey(r.step, 24, scale);
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

    // ── SUB_THRESHOLD_VELOCITY ─────────────────────────────────
    // 5+ sub-threshold transactions ($8K–$10K) in 24 hours

    private checkSubThresholdVelocity(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        const filtered = preFilterForSubThreshold(records).filter(
            (r) => r.amount < 10000
        );
        if (filtered.length < 5) return [];

        const violations: ViolationResult[] = [];

        const windows = new Map<number, NormalizedRecord[]>();
        for (const r of filtered) {
            const wk = getWindowKey(r.step, 24, scale);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }

        for (const [, txns] of windows) {
            if (txns.length >= 5) {
                violations.push(
                    this.createWindowedViolation(rule, account, txns, {
                        actual_value: txns.length,
                        threshold: 5,
                    })
                );
            }
        }

        return violations;
    }

    // ── SAR_VELOCITY ───────────────────────────────────────────
    // SUM(amount) > $25,000 in 24h

    private checkSarVelocity(
        rule: Rule,
        account: string,
        records: NormalizedRecord[],
        scale: number
    ): ViolationResult[] {
        const violations: ViolationResult[] = [];

        const windows = new Map<number, NormalizedRecord[]>();
        for (const r of records) {
            const wk = getWindowKey(r.step, 24, scale);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }

        for (const [, txns] of windows) {
            const total = txns.reduce((s, r) => s + r.amount, 0);
            if (total > 25000) {
                violations.push(
                    this.createWindowedViolation(rule, account, txns, {
                        actual_value: total,
                        threshold: 25000,
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

    private createViolation(
        rule: Rule,
        record: NormalizedRecord
    ): ViolationResult {
        return {
            id: uuid(),
            rule_id: rule.rule_id,
            rule_name: rule.name,
            severity: rule.severity,
            record_id: `${record.step}_${record.account}`,
            account: record.account,
            amount: record.amount,
            transaction_type: record.type,
            evidence: { ...record },
            threshold: rule.threshold ?? 0,
            actual_value: record.amount,
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
