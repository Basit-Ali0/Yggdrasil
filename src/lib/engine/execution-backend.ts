// ============================================================
// ExecutionBackend — pluggable scan execution (memory, DuckDB, …)
// ============================================================

import type { Rule, NormalizedRecord } from '../types';
import type { ViolationResult } from './violation-result';

export type { ViolationResult } from './violation-result';

export interface ExecutionBackend {
    readonly name: string;

    /**
     * Whether this backend can execute the rule after engine normalization.
     * Used to fall back to in-memory for unsupported families.
     */
    supportsRule(rule: Rule): boolean;

    /**
     * Stages already-normalized rows. Safe to no-op for in-memory.
     */
    prepare?(records: NormalizedRecord[]): void | Promise<void>;

    /**
     * Raw data path: stages un-normalized rows using the column mapping so
     * projection happens inside the backend (e.g. DuckDB SQL), not in Node.
     * When implemented, RuleExecutor will call this instead of normalize→prepare.
     */
    prepareRaw?(
        rawRows: Record<string, unknown>[],
        mapping: Record<string, string>
    ): void | Promise<void>;

    execute(
        rule: Rule,
        records: NormalizedRecord[],
        temporalScale: number
    ): ViolationResult[] | Promise<ViolationResult[]>;

    dispose?(): void | Promise<void>;
}
