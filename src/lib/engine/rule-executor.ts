// ============================================================
// RuleExecutor — Orchestrates: normalize → pre-filter → execute
// Deterministic: LLM extracts rules, code enforces them
// ============================================================

import { Rule, NormalizedRecord, ExecutionConfig } from '../types';
import { InMemoryBackend, ViolationResult } from './in-memory-backend';
import { normalizeRecord } from './schema-adapter';

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

        // Step 3: Execute each active rule
        const violations: ViolationResult[] = [];
        const activeRules = rules.filter((r) => r.is_active);
        let rulesProcessed = 0;

        for (const rule of activeRules) {
            const ruleViolations = this.backend.execute(
                rule,
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
