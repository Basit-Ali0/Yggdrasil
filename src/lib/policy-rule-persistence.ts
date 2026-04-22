// ============================================================
// Persist extracted LLM rules — normalize, validate, DB row shape
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RuleValidationIssue } from '@/lib/engine/rule-validation';
import { validateRuleForExecution } from '@/lib/engine/rule-validation';
import { normalizeRuleForEngine } from '@/lib/engine/rule-engine-normalize';
import type { RawExtractedRule } from '@/lib/validators/extracted-policy-rules';
import { rawExtractedRuleToRule } from '@/lib/validators/extracted-policy-rules';
import type { Rule } from '@/lib/types';

function isMissingValidationColumnsError(error: { message?: string; code?: string }): boolean {
    const msg = (error.message ?? '').toLowerCase();
    if (error.code === '42703') return true;
    return (
        (msg.includes('validation_status') || msg.includes('validation_issues')) &&
        (msg.includes('does not exist') || msg.includes('unknown column'))
    );
}

/**
 * Insert rule rows; if DB has not applied P1-14 migration, retry without validation columns.
 */
export async function insertPolicyRuleRows(
    supabase: SupabaseClient,
    rows: Array<Record<string, unknown>>
): Promise<{ error: { message: string; code?: string } | null }> {
    const first = await supabase.from('rules').insert(rows as never);
    if (!first.error) return { error: null };

    if (isMissingValidationColumnsError(first.error)) {
        const stripped = rows.map((row) => {
            const { validation_status: _vs, validation_issues: _vi, ...rest } = row;
            return rest;
        });
        const second = await supabase.from('rules').insert(stripped as never);
        return { error: second.error };
    }

    return { error: first.error };
}

export type RulePersistenceValidationEntry = {
    rule_id: string;
    valid: boolean;
    issues: RuleValidationIssue[];
};

/**
 * Build a stable identity key for a rule using normalized fields.
 * Used for deduplication when appending rules to an existing policy.
 * Two rules are considered duplicates if they share normalized rule_id, type,
 * conditions (field + operator + value), threshold, and time_window.
 */
export function buildRuleIdentityKey(
    rule: Pick<Rule, 'rule_id' | 'type' | 'conditions' | 'threshold' | 'time_window'>
): string {
    const normalized = normalizeRuleForEngine({
        rule_id: rule.rule_id,
        type: rule.type,
        conditions: rule.conditions as Rule['conditions'],
        threshold: rule.threshold ?? null,
        time_window: rule.time_window ?? null,
        // Minimal defaults for normalizeRuleForEngine
        name: '',
        severity: 'MEDIUM',
        policy_excerpt: '',
        policy_section: '',
        is_active: true,
    });

    const ruleId = normalized.rule_id.toUpperCase().trim();
    const type = (normalized.type ?? '').toLowerCase().trim();
    const cond = normalized.conditions
        ? `${String(normalized.conditions.field ?? '').trim()}|${String(normalized.conditions.operator ?? '').trim()}|${JSON.stringify(normalized.conditions.value ?? null)}`
        : '';
    return [
        ruleId,
        type,
        cond,
        String(normalized.threshold ?? ''),
        String(normalized.time_window ?? ''),
    ].join('::');
}

/**
 * Build identity keys for a set of existing DB rule rows.
 * Each row should have at minimum: rule_id, type, conditions, threshold, time_window.
 */
export function buildExistingRuleIdentitySet(
    dbRows: Array<{ rule_id: string; type: string; conditions: any; threshold: any; time_window: any }>
): Set<string> {
    const keys = new Set<string>();
    for (const row of dbRows) {
        const rule: Rule = {
            rule_id: row.rule_id,
            type: row.type,
            conditions: row.conditions ?? { field: '', operator: '', value: null },
            threshold: row.threshold != null ? parseFloat(String(row.threshold)) : null,
            time_window: row.time_window != null ? parseInt(String(row.time_window), 10) : null,
            // Minimal shape for key building
            name: '', severity: 'MEDIUM', policy_excerpt: '', policy_section: '', is_active: true,
        };
        keys.add(buildRuleIdentityKey(rule));
    }
    return keys;
}

export function buildRuleRowsFromExtraction(
    extracted: RawExtractedRule[],
    policyId: string,
    makeId: () => string
): {
    rows: Array<Record<string, unknown>>;
    validation: RulePersistenceValidationEntry[];
} {
    const validation: RulePersistenceValidationEntry[] = [];
    const rows = extracted.map((raw) => {
        const base = rawExtractedRuleToRule(raw);
        const vr = validateRuleForExecution(base);
        const r = vr.engineRule;
        validation.push({
            rule_id: r.rule_id,
            valid: vr.valid,
            issues: vr.issues,
        });
        return {
            id: makeId(),
            policy_id: policyId,
            rule_id: r.rule_id,
            name: r.name,
            type: r.type,
            description: r.description ?? null,
            threshold: r.threshold ?? null,
            time_window: r.time_window ?? null,
            severity: r.severity,
            conditions: r.conditions,
            policy_excerpt: r.policy_excerpt,
            policy_section: r.policy_section || null,
            is_active: vr.valid,
            validation_status: vr.valid ? 'valid' : 'invalid',
            validation_issues: vr.valid ? null : vr.issues,
        };
    });
    return { rows, validation };
}

/** Count rules that will be stored as active (executable). */
export function countActiveFromValidation(v: RulePersistenceValidationEntry[]): number {
    return v.filter((x) => x.valid).length;
}
