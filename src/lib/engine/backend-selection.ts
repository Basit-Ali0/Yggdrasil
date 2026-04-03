// ============================================================
// Backend selection — row threshold, feature flag
// Env: YGG_EXECUTION_BACKEND=auto|memory|duckdb
//      YGG_DUCKDB_ROW_THRESHOLD=<positive int, default 50000>
// ============================================================

import type { Rule } from '../types';
import type { ExecutionBackend } from './execution-backend';
import { InMemoryBackend } from './in-memory-backend';
import { DuckDbExecutionBackend } from './duckdb-backend';

export type ForcedExecutionBackend = 'auto' | 'memory' | 'duckdb';

export function parseExecutionBackendEnv(): ForcedExecutionBackend {
    const v = (process.env.YGG_EXECUTION_BACKEND || 'auto').toLowerCase().trim();
    if (v === 'memory' || v === 'in-memory') return 'memory';
    if (v === 'duckdb') return 'duckdb';
    return 'auto';
}

export function duckdbRowThreshold(): number {
    const raw = process.env.YGG_DUCKDB_ROW_THRESHOLD;
    const n = raw ? parseInt(raw, 10) : 50_000;
    return Number.isFinite(n) && n > 0 ? n : 50_000;
}

export type ExecutionBackendChoice = {
    kind: 'memory' | 'duckdb';
    reason: string;
};

export function chooseExecutionBackend(options: {
    rowCount: number;
    rules: Rule[];
    force?: ForcedExecutionBackend;
}): ExecutionBackendChoice {
    const force = options.force ?? parseExecutionBackendEnv();
    const threshold = duckdbRowThreshold();

    if (force === 'memory') {
        return { kind: 'memory', reason: 'YGG_EXECUTION_BACKEND=memory' };
    }

    if (force === 'duckdb') {
        return { kind: 'duckdb', reason: 'YGG_EXECUTION_BACKEND=duckdb' };
    }

    if (options.rowCount >= threshold) {
        return {
            kind: 'duckdb',
            reason: `rowCount ${options.rowCount} >= threshold ${threshold}`,
        };
    }

    return { kind: 'memory', reason: `rowCount ${options.rowCount} < threshold ${threshold}` };
}

export function createExecutionBackend(kind: 'memory' | 'duckdb'): ExecutionBackend {
    if (kind === 'duckdb') {
        try {
            return new DuckDbExecutionBackend();
        } catch (e) {
            console.error(
                '[execution-backend] DuckDB init failed, falling back to in-memory:',
                e
            );
            return new InMemoryBackend();
        }
    }
    return new InMemoryBackend();
}
