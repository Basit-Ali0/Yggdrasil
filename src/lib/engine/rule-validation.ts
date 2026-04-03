// ============================================================
// Rule validation — executable vs quarantined (P1-11 / P1-12)
// Run after `normalizeRuleForEngine` internally; callers may pass raw DB rules.
// ============================================================

import type { Rule, RuleCondition } from '../types';
import { WINDOWED_RULE_TYPES } from '../types';
import { normalizeRuleForEngine } from './rule-engine-normalize';

export type RuleValidationIssueCategory =
    | 'unsupported_operator'
    | 'invalid_condition_shape'
    | 'invalid_threshold'
    | 'missing_required_field'
    | 'invalid_severity'
    | 'incompatible_condition_value';

const SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM']);

/** Single-transaction rules implemented with hardcoded logic (conditions not used for matching). */
export const HARDCODED_SINGLE_TX_RULE_IDS = new Set([
    'CTR_THRESHOLD',
    'SAR_THRESHOLD',
    'BALANCE_MISMATCH',
    'FRAUD_INDICATOR',
    'HIGH_VALUE_TRANSFER',
]);

export function isWindowedRuleType(type: string): boolean {
    return (WINDOWED_RULE_TYPES as readonly string[]).includes(
        type as (typeof WINDOWED_RULE_TYPES)[number]
    );
}

/**
 * Normalize operator token to engine-internal form, or null if unknown.
 */
export function canonicalizeOperator(op: string): string | null {
    const normalized = op.trim().toLowerCase();
    const map: Record<string, string> = {
        '>=': '>=',
        '>': '>',
        '<=': '<=',
        '<': '<',
        '==': '==',
        '!=': '!=',
        in: 'IN',
        between: 'BETWEEN',
        equals: '==',
        equal: '==',
        eq: '==',
        not_equals: '!=',
        not_equal: '!=',
        neq: '!=',
        ne: '!=',
        greater_than: '>',
        gt: '>',
        greater_than_or_equal: '>=',
        gte: '>=',
        less_than: '<',
        lt: '<',
        less_than_or_equal: '<=',
        lte: '<=',
        exists: 'EXISTS',
        not_exists: 'NOT_EXISTS',
        contains: 'CONTAINS',
        includes: 'CONTAINS',
    };
    if (map[normalized]) return map[normalized];
    const t = op.trim();
    if (['>=', '>', '<=', '<', '==', '!='].includes(t)) return t;
    return null;
}

function isFiniteNumberish(value: unknown): boolean {
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string' && value.trim() !== '') return Number.isFinite(Number(value));
    return false;
}

function validateConditionValue(
    canonicalOp: string,
    value: unknown
): { category: RuleValidationIssueCategory; message: string; path?: string } | null {
    switch (canonicalOp) {
        case 'IN':
            if (!Array.isArray(value) || value.length === 0) {
                return {
                    category: 'incompatible_condition_value',
                    message: 'IN requires a non-empty array value',
                    path: 'conditions.value',
                };
            }
            return null;
        case 'BETWEEN':
            if (!Array.isArray(value) || value.length < 2) {
                return {
                    category: 'incompatible_condition_value',
                    message: 'BETWEEN requires an array of at least two bounds',
                    path: 'conditions.value',
                };
            }
            if (!isFiniteNumberish(value[0]) || !isFiniteNumberish(value[1])) {
                return {
                    category: 'incompatible_condition_value',
                    message: 'BETWEEN bounds must be numeric',
                    path: 'conditions.value',
                };
            }
            return null;
        case 'EXISTS':
        case 'NOT_EXISTS':
            return null;
        case 'CONTAINS':
            if (typeof value !== 'string') {
                return {
                    category: 'incompatible_condition_value',
                    message: 'CONTAINS value must be a string',
                    path: 'conditions.value',
                };
            }
            return null;
        case '>=':
        case '>':
        case '<=':
        case '<':
            if (!isFiniteNumberish(value)) {
                return {
                    category: 'incompatible_condition_value',
                    message: `operator ${canonicalOp} requires a numeric value`,
                    path: 'conditions.value',
                };
            }
            return null;
        case '==':
        case '!=':
            if (
                value === undefined ||
                (typeof value === 'object' && value !== null && !Array.isArray(value))
            ) {
                return {
                    category: 'incompatible_condition_value',
                    message: `operator ${canonicalOp} requires a scalar or array (for IN only) value`,
                    path: 'conditions.value',
                };
            }
            return null;
        default:
            return null;
    }
}

function validateThreshold(rule: Rule): RuleValidationIssue | null {
    if (rule.threshold === null || rule.threshold === undefined) return null;
    const t =
        typeof rule.threshold === 'number' ? rule.threshold : Number(rule.threshold);
    if (!Number.isFinite(t)) {
        return {
            category: 'invalid_threshold',
            message: 'threshold must be a finite number when set',
            path: 'threshold',
        };
    }
    return null;
}

export interface RuleValidationIssue {
    category: RuleValidationIssueCategory;
    message: string;
    path?: string;
}

export interface RuleValidationResult {
    valid: boolean;
    issues: RuleValidationIssue[];
    /** Rule after `normalizeRuleForEngine` (IDs/types aligned with executor). */
    engineRule: Rule;
}

/**
 * Returns whether this rule can be executed by the engine without silent misbehavior.
 * Invalid rules should be stored with `is_active: false` at ingest time and skipped at scan time.
 */
export function validateRuleForExecution(rule: Rule): RuleValidationResult {
    const engineRule = normalizeRuleForEngine({ ...rule });
    const issues: RuleValidationIssue[] = [];

    if (!SEVERITIES.has(engineRule.severity)) {
        issues.push({
            category: 'invalid_severity',
            message: `severity must be CRITICAL, HIGH, or MEDIUM (got ${String(engineRule.severity)})`,
            path: 'severity',
        });
    }

    const th = validateThreshold(engineRule);
    if (th) issues.push(th);

    const cond = engineRule.conditions as RuleCondition | null | undefined;
    if (cond == null || typeof cond !== 'object' || Array.isArray(cond)) {
        issues.push({
            category: 'invalid_condition_shape',
            message: 'conditions must be a non-array object',
            path: 'conditions',
        });
        return { valid: issues.length === 0, issues, engineRule };
    }

    if (isWindowedRuleType(engineRule.type) || HARDCODED_SINGLE_TX_RULE_IDS.has(engineRule.rule_id)) {
        return { valid: issues.length === 0, issues, engineRule };
    }

    if (typeof cond.field !== 'string' || !cond.field.trim()) {
        issues.push({
            category: 'missing_required_field',
            message: 'conditions.field is required for generic executable rules',
            path: 'conditions.field',
        });
    }

    if (typeof cond.operator !== 'string' || !cond.operator.trim()) {
        issues.push({
            category: 'unsupported_operator',
            message: 'conditions.operator is required',
            path: 'conditions.operator',
        });
    } else {
        const cop = canonicalizeOperator(cond.operator);
        if (cop === null) {
            issues.push({
                category: 'unsupported_operator',
                message: `operator is not supported: ${cond.operator}`,
                path: 'conditions.operator',
            });
        } else {
            const ve = validateConditionValue(cop, cond.value);
            if (ve) issues.push(ve);
        }
    }

    return {
        valid: issues.length === 0,
        issues,
        engineRule,
    };
}

/** Filter to rules that pass execution validation (for scan). */
export function filterExecutableRules(rules: Rule[]): Rule[] {
    return rules.filter((r) => validateRuleForExecution(r).valid);
}
