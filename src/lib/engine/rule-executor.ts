// ============================================================
// RuleExecutor — Backend selection first, then normalize or raw-project
// Deterministic: LLM extracts rules, code enforces them
// ============================================================

import { Rule, NormalizedRecord, ExecutionConfig } from '../types';
import type { ViolationResult } from './violation-result';
import type { ExecutionBackend } from './execution-backend';
import { InMemoryBackend } from './in-memory-backend';
import { normalizeRecord } from './schema-adapter';
import { normalizeRuleForEngine } from './rule-engine-normalize';
import {
    chooseExecutionBackend,
    createExecutionBackend,
    type ForcedExecutionBackend,
} from './backend-selection';
import { logStructured } from '@/lib/structured-log';

async function finalize<T>(value: T | Promise<T>): Promise<T> {
    return await Promise.resolve(value);
}

export type RuleExecutorOptions = {
    /** Raw row count hint for backend selection (overrides rawRecords.length if set). */
    rowCount?: number;
    /** Override env-based backend selection (tests / rollout). */
    forceBackend?: ForcedExecutionBackend;
};

export class RuleExecutor {
    private readonly memoryBackend: InMemoryBackend;
    private readonly options: RuleExecutorOptions;

    constructor(options: RuleExecutorOptions = {}) {
        this.memoryBackend = new InMemoryBackend();
        this.options = options;
    }

    /**
     * Execute all active rules against the dataset.
     *
     * DuckDB path (when backend = duckdb AND backend.prepareRaw is available):
     *   - Raw rows are staged directly into DuckDB without Node-side normalization.
     *   - No 50k sampling cap; full dataset is executed.
     *   - executionReason reflects "fully executed (N rows)".
     *
     * In-memory path:
     *   - Rows are normalized via normalizeRecord in Node.
     *   - Applied sampleLimit cap (default 50k).
     *   - executionReason reflects "sampled M of N rows" when capped.
     */
    async executeAll(
        rules: Rule[],
        rawRecords: Record<string, any>[],
        config: ExecutionConfig
    ): Promise<{
        violations: ViolationResult[];
        rulesProcessed: number;
        rulesTotal: number;
        executionBackend: string;
        executionReason: string;
        sampled: boolean;
        effectiveRowCount: number;
    }> {
        const activeRules = rules.filter((r) => r.is_active);

        // Choose backend from raw row count — before any normalization
        const choice = chooseExecutionBackend({
            rowCount: this.options.rowCount ?? rawRecords.length,
            rules: activeRules,
            force: this.options.forceBackend,
        });

        const primary: ExecutionBackend = createExecutionBackend(choice.kind);

        let records: NormalizedRecord[] = [];
        let sampled = false;
        let effectiveRowCount = rawRecords.length;
        let executionReason = choice.reason;

        if (typeof primary.prepareRaw === 'function') {
            // DuckDB raw path: project inside DuckDB, no Node normalization, no sampling cap
            await finalize(primary.prepareRaw(rawRecords, config.columnMapping));
            effectiveRowCount = rawRecords.length;
            executionReason = `${choice.reason}; fully executed (${rawRecords.length} rows)`;
        } else {
            // In-memory path: normalize in Node, then apply sample cap
            const normalized = rawRecords.map((r) => normalizeRecord(r, config.columnMapping));
            if (normalized.length > config.sampleLimit) {
                records = normalized.slice(0, config.sampleLimit);
                sampled = true;
                effectiveRowCount = config.sampleLimit;
                executionReason = `${choice.reason}; sampled ${config.sampleLimit} of ${normalized.length} rows`;
            } else {
                records = normalized;
            }
            await finalize(primary.prepare?.(records) ?? Promise.resolve());
        }

        logStructured('RuleExecutor', 'backend_selected', {
            backend: primary.name,
            reason: executionReason,
            raw_row_count: rawRecords.length,
            effective_row_count: effectiveRowCount,
            active_rules: activeRules.length,
            sampled,
        });

        const violations: ViolationResult[] = [];
        let rulesProcessed = 0;

        // Lazy normalized fallback for the rare case DuckDB can't handle a rule type
        let lazyNormalized: NormalizedRecord[] | null = null;
        const getFallbackRecords = (): NormalizedRecord[] => {
            if (!lazyNormalized) {
                lazyNormalized = rawRecords
                    .slice(0, config.sampleLimit)
                    .map((r) => normalizeRecord(r, config.columnMapping));
            }
            return lazyNormalized;
        };

        try {
            for (const rule of activeRules) {
                const engineRule = normalizeRuleForEngine(rule);
                const usesPrimary = primary.supportsRule(engineRule);
                const backend: ExecutionBackend = usesPrimary ? primary : this.memoryBackend;

                // Determine records for this backend invocation
                let backendRecords: NormalizedRecord[];
                if (usesPrimary && typeof primary.prepareRaw === 'function') {
                    // DuckDB: ignores the records argument (queries its staged table)
                    backendRecords = [];
                } else if (!usesPrimary) {
                    // In-memory fallback from DuckDB path
                    backendRecords = getFallbackRecords();
                } else {
                    // Normal in-memory path
                    backendRecords = records;
                }

                const batch = await finalize(
                    backend.execute(engineRule, backendRecords, config.temporalScale)
                );
                violations.push(...batch);
                rulesProcessed++;
            }
        } finally {
            await finalize(primary.dispose?.() ?? Promise.resolve());
        }

        return {
            violations,
            rulesProcessed,
            rulesTotal: activeRules.length,
            executionBackend: primary.name,
            executionReason,
            sampled,
            effectiveRowCount,
        };
    }
}
