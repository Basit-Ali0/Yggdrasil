// ============================================================
// normalizeRuleForEngine — LLM / DB rule → engine-recognized IDs/types
// Single path for RuleExecutor and backend selection (P1-10 will extend).
// ============================================================

import type { Rule } from '../types';

/**
 * Map Gemini-extracted rule IDs/types to engine-recognized IDs/types.
 * Uses keyword matching so any LLM naming convention works.
 */
export function normalizeRuleForEngine(rule: Rule): Rule {
    const id = rule.rule_id.toUpperCase();
    const desc = (rule.description || '').toLowerCase();
    const name = (rule.name || '').toLowerCase();
    const combined = `${id} ${desc} ${name}`;

    if (id.includes('CTR') && (id.includes('THRESHOLD') || id.includes('FILING'))) {
        return { ...rule, rule_id: 'CTR_THRESHOLD', type: 'single_transaction' };
    }
    if (id.includes('SAR') && (id.includes('THRESHOLD') || id.includes('FILING'))) {
        return { ...rule, rule_id: 'SAR_THRESHOLD', type: 'single_transaction' };
    }
    if (id.includes('HIGH_VALUE') || (id.includes('HIGH') && combined.includes('50000'))) {
        return { ...rule, rule_id: 'HIGH_VALUE_TRANSFER', type: 'single_transaction' };
    }
    if (id.includes('BALANCE') && id.includes('MISMATCH')) {
        return { ...rule, rule_id: 'BALANCE_MISMATCH', type: 'single_transaction' };
    }
    if (id.includes('FRAUD')) {
        return { ...rule, rule_id: 'FRAUD_INDICATOR', type: 'single_transaction' };
    }

    if (id.includes('STRUCTURING') || combined.includes('structuring')) {
        return { ...rule, type: 'structuring' };
    }
    if (id.includes('VELOCITY') || combined.includes('velocity')) {
        if (combined.includes('sar') || combined.includes('rapid') || combined.includes('25000')) {
            return { ...rule, type: 'sar_velocity' };
        }
        return { ...rule, type: 'sub_threshold_velocity' };
    }
    if (id.includes('RAPID') || combined.includes('rapid movement')) {
        return { ...rule, type: 'sar_velocity' };
    }
    if (id.includes('ROUND') || combined.includes('round amount')) {
        return { ...rule, type: 'round_amount' };
    }
    if (id.includes('DORMANT') || combined.includes('dormant')) {
        return { ...rule, type: 'dormant_reactivation' };
    }
    if (id.includes('AGGREGAT') || combined.includes('aggregat')) {
        return { ...rule, type: 'ctr_aggregation' };
    }

    return rule;
}
