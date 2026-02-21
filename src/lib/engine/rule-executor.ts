// ============================================================
// RuleExecutor — Orchestrates: normalize → pre-filter → execute
// Deterministic: LLM extracts rules, code enforces them
// ============================================================

import { Rule, NormalizedRecord, ExecutionConfig } from '../types';
import { InMemoryBackend, ViolationResult } from './in-memory-backend';
import { normalizeRecord } from './schema-adapter';

/**
 * Map Gemini-extracted rule IDs/types to engine-recognized IDs/types.
 * Uses keyword matching so any LLM naming convention works.
 */
function normalizeRuleForEngine(rule: Rule): Rule {
    const id = rule.rule_id.toUpperCase();
    const desc = (rule.description || '').toLowerCase();
    const name = (rule.name || '').toLowerCase();
    const combined = `${id} ${desc} ${name}`;

    // Single-tx rule ID mappings
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

    // Windowed rule type mappings
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

    // Unrecognized rules — let the generic condition checker handle them
    return rule;
}

export class RuleExecutor {
    private backend: InMemoryBackend;

    constructor() {
        this.backend = new InMemoryBackend();
    }

    /**
     * Execute all active rules against the dataset.
     * Returns all violations found.
     */
    executeAll(
        rules: Rule[],
        rawRecords: Record<string, any>[],
        config: ExecutionConfig
    ): {
        violations: ViolationResult[];
        rulesProcessed: number;
        rulesTotal: number;
    } {
        // Step 1: Normalize records using confirmed column mapping
        const normalized: NormalizedRecord[] = rawRecords.map((r) =>
            normalizeRecord(r, config.columnMapping)
        );

        // Step 2: Sample if over limit
        const sampled =
            normalized.length > config.sampleLimit
                ? normalized.slice(0, config.sampleLimit)
                : normalized;

        // Step 3: Execute each active rule (normalize IDs for engine compatibility)
        const violations: ViolationResult[] = [];
        const activeRules = rules.filter((r) => r.is_active);
        let rulesProcessed = 0;

        for (const rule of activeRules) {
            const engineRule = normalizeRuleForEngine(rule);
            const ruleViolations = this.backend.execute(
                engineRule,
                sampled,
                config.temporalScale
            );
            violations.push(...ruleViolations);
            rulesProcessed++;
        }

        return {
            violations,
            rulesProcessed,
            rulesTotal: activeRules.length,
        };
    }
}
