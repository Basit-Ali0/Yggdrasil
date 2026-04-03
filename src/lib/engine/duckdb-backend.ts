// ============================================================
// DuckDbExecutionBackend — single-transaction + windowed rules via SQL
// Mirrors InMemoryBackend logic (temporal windows via floor(step*scale/windowHours))
// ============================================================

import { randomUUID } from 'crypto';
import duckdb, { type TableData } from 'duckdb';
import type { Connection } from 'duckdb';
import type { Rule, NormalizedRecord } from '../types';
import { WINDOWED_RULE_TYPES } from '../types';
import type { ExecutionBackend } from './execution-backend';
import type { ViolationResult } from './violation-result';
import { generateExplanation, generateWindowedExplanation } from './explainability';
import { normalizedSelectFromJsonPayload } from './duckdb-projection';

const NORM_TABLE = 'ygg_norm';

function execAsync(conn: Connection, sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
        conn.exec(sql, (err) => (err ? reject(err) : resolve()));
    });
}

function allAsync(conn: Connection, sql: string): Promise<TableData> {
    return new Promise((resolve, reject) => {
        conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows ?? [])));
    });
}

function isWindowedType(type: string): boolean {
    return (WINDOWED_RULE_TYPES as readonly string[]).includes(
        type as (typeof WINDOWED_RULE_TYPES)[number]
    );
}

function assertFiniteScale(scale: number): number {
    const s = Number(scale);
    if (!Number.isFinite(s)) {
        throw new Error('DuckDbExecutionBackend: temporalScale must be a finite number');
    }
    return s;
}

function dormancyStepGapThreshold(scale: number): number {
    const s = assertFiniteScale(scale);
    return 90 * (s === 24 ? 1 : s);
}

const FIELD_TO_COL: Record<string, string> = {
    amount: 'amount',
    account: 'account',
    recipient: 'recipient',
    step: 'step',
    type: 'type',
    oldbalanceOrg: 'oldbalance_org',
    newbalanceOrig: 'newbalance_orig',
    oldbalanceDest: 'oldbalance_dest',
    newbalanceDest: 'newbalance_dest',
};

function sqlLiteral(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeOperator(op: string): string {
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
    return map[normalized] || op.trim();
}

function sqlColumnForField(field: string): string {
    const c = FIELD_TO_COL[field] || field.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return c;
}

function buildGenericWhere(rule: Rule): string | null {
    const cond = rule.conditions;
    if (!cond?.field) return null;
    const col = sqlColumnForField(cond.field);
    const op = normalizeOperator(cond.operator);
    const ref = `${NORM_TABLE}.${col}`;

    switch (op) {
        case '>=':
            return `${ref} >= ${sqlLiteral(cond.value)}`;
        case '>':
            return `${ref} > ${sqlLiteral(cond.value)}`;
        case '<=':
            return `${ref} <= ${sqlLiteral(cond.value)}`;
        case '<':
            return `${ref} < ${sqlLiteral(cond.value)}`;
        case '==':
            return `${ref} = ${sqlLiteral(cond.value)}`;
        case '!=':
            return `${ref} <> ${sqlLiteral(cond.value)}`;
        case 'IN':
            if (!Array.isArray(cond.value) || cond.value.length === 0) return 'FALSE';
            return `${ref} IN (${cond.value.map(sqlLiteral).join(', ')})`;
        case 'BETWEEN':
            if (!Array.isArray(cond.value) || cond.value.length < 2) return 'FALSE';
            return `${ref} BETWEEN ${sqlLiteral(cond.value[0])} AND ${sqlLiteral(cond.value[1])}`;
        case 'EXISTS':
            return `(${ref} IS NOT NULL AND CAST(${ref} AS VARCHAR) <> '')`;
        case 'NOT_EXISTS':
            return `(${ref} IS NULL OR CAST(${ref} AS VARCHAR) = '')`;
        case 'CONTAINS':
            return `(LOWER(CAST(${ref} AS VARCHAR)) LIKE '%' || LOWER(${sqlLiteral(cond.value)}) || '%')`;
        default:
            return null;
    }
}

function singleTxWhereSql(rule: Rule): string | null {
    switch (rule.rule_id) {
        case 'CTR_THRESHOLD':
            return (
                `${NORM_TABLE}.amount >= 10000 AND upper(${NORM_TABLE}.type) IN ` +
                `('WIRE','CASH_OUT','TRANSFER','DEPOSIT','CASH_IN')`
            );
        case 'SAR_THRESHOLD':
            return (
                `${NORM_TABLE}.amount >= 5000 AND upper(${NORM_TABLE}.type) IN ('WIRE','TRANSFER')`
            );
        case 'BALANCE_MISMATCH':
            return (
                `${NORM_TABLE}.oldbalance_org IS NOT NULL AND ${NORM_TABLE}.newbalance_orig IS NOT NULL ` +
                `AND abs((${NORM_TABLE}.oldbalance_org - ${NORM_TABLE}.amount) - ${NORM_TABLE}.newbalance_orig) > 0.01`
            );
        case 'FRAUD_INDICATOR':
            return (
                `upper(${NORM_TABLE}.type) IN ('CASH_OUT','TRANSFER') ` +
                `AND ${NORM_TABLE}.oldbalance_dest = 0 ` +
                `AND coalesce(${NORM_TABLE}.newbalance_dest, 0) > 0`
            );
        case 'HIGH_VALUE_TRANSFER':
            return (
                `upper(${NORM_TABLE}.type) IN ('WIRE','TRANSFER') AND ${NORM_TABLE}.amount > 50000`
            );
        default:
            return buildGenericWhere(rule);
    }
}

function rowToRecord(row: Record<string, unknown>): NormalizedRecord {
    const payload = row.payload;
    if (typeof payload === 'string' && payload.length > 0) {
        try {
            return JSON.parse(payload) as NormalizedRecord;
        } catch {
            /* use scalars */
        }
    }
    return {
        account: String(row.account ?? ''),
        recipient: String(row.recipient ?? ''),
        amount: Number(row.amount) || 0,
        step: Number(row.step) || 0,
        type: String(row.type ?? ''),
        oldbalanceOrg:
            row.oldbalance_org === null || row.oldbalance_org === undefined
                ? undefined
                : Number(row.oldbalance_org),
        newbalanceOrig:
            row.newbalance_orig === null || row.newbalance_orig === undefined
                ? undefined
                : Number(row.newbalance_orig),
        oldbalanceDest:
            row.oldbalance_dest === null || row.oldbalance_dest === undefined
                ? undefined
                : Number(row.oldbalance_dest),
        newbalanceDest:
            row.newbalance_dest === null || row.newbalance_dest === undefined
                ? undefined
                : Number(row.newbalance_dest),
    };
}

function parseRecordsFromPayloadList(payloads: unknown): NormalizedRecord[] {
    if (!Array.isArray(payloads)) return [];
    const out: NormalizedRecord[] = [];
    for (const p of payloads) {
        if (typeof p !== 'string' || !p.length) continue;
        try {
            out.push(JSON.parse(p) as NormalizedRecord);
        } catch {
            /* skip */
        }
    }
    return out.sort((a, b) => a.step - b.step);
}

function buildWindowedViolation(
    rule: Rule,
    account: string,
    records: NormalizedRecord[],
    extras: Record<string, unknown> = {}
): ViolationResult {
    const sorted = [...records].sort((a, b) => a.step - b.step);
    const total = sorted.reduce((sum, r) => sum + r.amount, 0);

    return {
        id: randomUUID(),
        rule_id: rule.rule_id,
        rule_name: rule.name,
        severity: rule.severity,
        record_id: `${account}_${rule.rule_id}_${sorted[0]?.step ?? 0}`,
        account,
        amount: total,
        transaction_type: sorted[0]?.type ?? '',
        evidence: {
            account,
            transaction_count: sorted.length,
            amounts: sorted.map((r) => r.amount),
            records: sorted.slice(0, 10),
        },
        threshold: Number(extras.threshold ?? rule.threshold ?? 0),
        actual_value: Number(extras.actual_value ?? total),
        policy_excerpt: rule.policy_excerpt,
        policy_section: rule.policy_section ?? '',
        explanation: generateWindowedExplanation(rule, account, sorted, extras),
        status: 'pending',
    };
}

function windowKeyExpr(scale: number, windowHours: number): string {
    const s = assertFiniteScale(scale);
    const w = assertFiniteScale(windowHours);
    return `floor((${NORM_TABLE}.step * ${s}) / ${w})::BIGINT`;
}

export class DuckDbExecutionBackend implements ExecutionBackend {
    readonly name = 'duckdb';
    private readonly db: duckdb.Database;
    private readonly conn: Connection;
    private staged = false;

    constructor() {
        this.db = new duckdb.Database(':memory:');
        this.conn = this.db.connect();
    }

    supportsRule(_rule: Rule): boolean {
        return true;
    }

    async prepare(records: NormalizedRecord[]): Promise<void> {
        await execAsync(this.conn, `DROP TABLE IF EXISTS ${NORM_TABLE}`);
        await execAsync(
            this.conn,
            `CREATE TABLE ${NORM_TABLE} (
        account VARCHAR,
        recipient VARCHAR,
        amount DOUBLE,
        step DOUBLE,
        type VARCHAR,
        oldbalance_org DOUBLE,
        newbalance_orig DOUBLE,
        oldbalance_dest DOUBLE,
        newbalance_dest DOUBLE,
        payload VARCHAR
      )`
        );

        const stmt = this.conn.prepare(
            `INSERT INTO ${NORM_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        try {
            for (const r of records) {
                await new Promise<void>((resolve, reject) => {
                    stmt.run(
                        r.account,
                        r.recipient,
                        r.amount,
                        r.step,
                        r.type,
                        r.oldbalanceOrg ?? null,
                        r.newbalanceOrig ?? null,
                        r.oldbalanceDest ?? null,
                        r.newbalanceDest ?? null,
                        JSON.stringify(r),
                        (err: Error | null) => (err ? reject(err) : resolve())
                    );
                });
            }
        } finally {
            await new Promise<void>((resolve, reject) => {
                stmt.finalize((err) => (err ? reject(err) : resolve()));
            });
        }

        this.staged = true;
    }

    /**
     * Raw data path: stage un-normalized rows as JSON, project into ygg_norm via SQL.
     * This avoids per-row normalization in Node and removes the 50k sampling cap for
     * DuckDB-backed scans. Uses the same projection semantics as normalizeRecord/
     * normalizedSelectExpressions for parity.
     */
    async prepareRaw(
        rawRows: Record<string, unknown>[],
        mapping: Record<string, string>
    ): Promise<void> {
        await execAsync(this.conn, `DROP TABLE IF EXISTS ygg_raw`);
        await execAsync(this.conn, `DROP TABLE IF EXISTS ${NORM_TABLE}`);
        await execAsync(this.conn, `CREATE TABLE ygg_raw (payload VARCHAR)`);

        const stmt = this.conn.prepare(`INSERT INTO ygg_raw VALUES (?)`);
        try {
            for (const row of rawRows) {
                await new Promise<void>((resolve, reject) => {
                    stmt.run(
                        JSON.stringify(row),
                        (err: Error | null) => (err ? reject(err) : resolve())
                    );
                });
            }
        } finally {
            await new Promise<void>((resolve, reject) => {
                stmt.finalize((err) => (err ? reject(err) : resolve()));
            });
        }

        const sel = normalizedSelectFromJsonPayload(mapping);
        await execAsync(
            this.conn,
            `CREATE TABLE ${NORM_TABLE} AS SELECT ${sel} FROM ygg_raw`
        );
        await execAsync(this.conn, `DROP TABLE ygg_raw`);
        this.staged = true;
    }

    execute(
        rule: Rule,
        _records: NormalizedRecord[],
        temporalScale: number
    ): ViolationResult[] | Promise<ViolationResult[]> {
        return this.executeAsync(rule, temporalScale);
    }

    private async executeAsync(rule: Rule, temporalScale: number): Promise<ViolationResult[]> {
        if (!this.staged) {
            throw new Error('DuckDbExecutionBackend: prepare() must run before execute()');
        }

        if (isWindowedType(rule.type)) {
            return this.runWindowed(rule, temporalScale);
        }

        const where = singleTxWhereSql(rule);
        if (!where) {
            return [];
        }

        const sql = `SELECT * FROM ${NORM_TABLE} WHERE ${where}`;
        const rows = await allAsync(this.conn, sql);
        const violations: ViolationResult[] = [];

        for (const row of rows) {
            const record = rowToRecord(row as Record<string, unknown>);
            violations.push({
                id: randomUUID(),
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
            });
        }

        return violations;
    }

    private async runWindowed(rule: Rule, scale: number): Promise<ViolationResult[]> {
        assertFiniteScale(scale);

        switch (rule.type) {
            case 'ctr_aggregation':
                return this.runCtrAggregation(rule, scale);
            case 'structuring':
                return this.runStructuring(rule, scale);
            case 'sub_threshold_velocity':
                return this.runSubThresholdVelocity(rule, scale);
            case 'sar_velocity':
                return this.runSarVelocity(rule, scale);
            case 'round_amount':
                return this.runRoundAmount(rule, scale);
            case 'dormant_reactivation':
                return this.runDormantReactivation(rule, scale);
            case 'velocity_limit':
                return [];
            default:
                return [];
        }
    }

    private async runCtrAggregation(rule: Rule, scale: number): Promise<ViolationResult[]> {
        const wk = windowKeyExpr(scale, 24);
        const sql = `
      SELECT
        ${NORM_TABLE}.account AS account,
        ${NORM_TABLE}.recipient AS recipient,
        ${wk} AS wk,
        sum(${NORM_TABLE}.amount) AS total_amt,
        count(*)::BIGINT AS txn_cnt,
        list(${NORM_TABLE}.payload ORDER BY ${NORM_TABLE}.step) AS payloads
      FROM ${NORM_TABLE}
      WHERE ${NORM_TABLE}.account IS NOT NULL AND CAST(${NORM_TABLE}.account AS VARCHAR) <> ''
      GROUP BY ${NORM_TABLE}.account, ${NORM_TABLE}.recipient, ${wk}
      HAVING sum(${NORM_TABLE}.amount) >= 10000 AND count(*) > 1
    `;
        const rows = await allAsync(this.conn, sql);
        const violations: ViolationResult[] = [];
        for (const row of rows) {
            const rec = row as Record<string, unknown>;
            const account = String(rec.account ?? '');
            const records = parseRecordsFromPayloadList(rec.payloads);
            if (records.length === 0) continue;
            violations.push(
                buildWindowedViolation(rule, account, records, {
                    actual_value: Number(rec.total_amt),
                    threshold: 10000,
                    recipient: String(rec.recipient ?? ''),
                })
            );
        }
        return violations;
    }

    private async runStructuring(rule: Rule, scale: number): Promise<ViolationResult[]> {
        const wk = windowKeyExpr(scale, 24);
        const sql = `
      SELECT
        ${NORM_TABLE}.account AS account,
        ${wk} AS wk,
        count(*)::BIGINT AS txn_cnt,
        sum(${NORM_TABLE}.amount) AS total_amt,
        list(${NORM_TABLE}.payload ORDER BY ${NORM_TABLE}.step) AS payloads
      FROM ${NORM_TABLE}
      WHERE ${NORM_TABLE}.account IS NOT NULL AND CAST(${NORM_TABLE}.account AS VARCHAR) <> ''
        AND ${NORM_TABLE}.amount >= 8000 AND ${NORM_TABLE}.amount < 10000
      GROUP BY ${NORM_TABLE}.account, ${wk}
      HAVING count(*) >= 3
    `;
        const rows = await allAsync(this.conn, sql);
        const violations: ViolationResult[] = [];
        for (const row of rows) {
            const rec = row as Record<string, unknown>;
            const account = String(rec.account ?? '');
            const records = parseRecordsFromPayloadList(rec.payloads);
            if (records.length === 0) continue;
            violations.push(
                buildWindowedViolation(rule, account, records, {
                    actual_value: Number(rec.txn_cnt),
                    threshold: 3,
                })
            );
        }
        return violations;
    }

    private async runSubThresholdVelocity(rule: Rule, scale: number): Promise<ViolationResult[]> {
        const wk = windowKeyExpr(scale, 24);
        const sql = `
      SELECT
        ${NORM_TABLE}.account AS account,
        ${wk} AS wk,
        count(*)::BIGINT AS txn_cnt,
        sum(${NORM_TABLE}.amount) AS total_amt,
        list(${NORM_TABLE}.payload ORDER BY ${NORM_TABLE}.step) AS payloads
      FROM ${NORM_TABLE}
      WHERE ${NORM_TABLE}.account IS NOT NULL AND CAST(${NORM_TABLE}.account AS VARCHAR) <> ''
        AND ${NORM_TABLE}.amount >= 8000 AND ${NORM_TABLE}.amount < 10000
      GROUP BY ${NORM_TABLE}.account, ${wk}
      HAVING count(*) >= 5
    `;
        const rows = await allAsync(this.conn, sql);
        const violations: ViolationResult[] = [];
        for (const row of rows) {
            const rec = row as Record<string, unknown>;
            const account = String(rec.account ?? '');
            const records = parseRecordsFromPayloadList(rec.payloads);
            if (records.length === 0) continue;
            violations.push(
                buildWindowedViolation(rule, account, records, {
                    actual_value: Number(rec.txn_cnt),
                    threshold: 5,
                })
            );
        }
        return violations;
    }

    private async runSarVelocity(rule: Rule, scale: number): Promise<ViolationResult[]> {
        const wk = windowKeyExpr(scale, 24);
        const sql = `
      SELECT
        ${NORM_TABLE}.account AS account,
        ${wk} AS wk,
        sum(${NORM_TABLE}.amount) AS total_amt,
        count(*)::BIGINT AS txn_cnt,
        list(${NORM_TABLE}.payload ORDER BY ${NORM_TABLE}.step) AS payloads
      FROM ${NORM_TABLE}
      WHERE ${NORM_TABLE}.account IS NOT NULL AND CAST(${NORM_TABLE}.account AS VARCHAR) <> ''
      GROUP BY ${NORM_TABLE}.account, ${wk}
      HAVING sum(${NORM_TABLE}.amount) > 25000
    `;
        const rows = await allAsync(this.conn, sql);
        const violations: ViolationResult[] = [];
        for (const row of rows) {
            const rec = row as Record<string, unknown>;
            const account = String(rec.account ?? '');
            const records = parseRecordsFromPayloadList(rec.payloads);
            if (records.length === 0) continue;
            violations.push(
                buildWindowedViolation(rule, account, records, {
                    actual_value: Number(rec.total_amt),
                    threshold: 25000,
                })
            );
        }
        return violations;
    }

    private async runRoundAmount(rule: Rule, scale: number): Promise<ViolationResult[]> {
        const wk = windowKeyExpr(scale, 720);
        const sql = `
      SELECT
        ${NORM_TABLE}.account AS account,
        ${wk} AS wk,
        count(*)::BIGINT AS txn_cnt,
        sum(${NORM_TABLE}.amount) AS total_amt,
        list(${NORM_TABLE}.payload ORDER BY ${NORM_TABLE}.step) AS payloads
      FROM ${NORM_TABLE}
      WHERE ${NORM_TABLE}.account IS NOT NULL AND CAST(${NORM_TABLE}.account AS VARCHAR) <> ''
        AND (round(${NORM_TABLE}.amount)::BIGINT % 1000) = 0
      GROUP BY ${NORM_TABLE}.account, ${wk}
      HAVING count(*) >= 3
    `;
        const rows = await allAsync(this.conn, sql);
        const violations: ViolationResult[] = [];
        for (const row of rows) {
            const rec = row as Record<string, unknown>;
            const account = String(rec.account ?? '');
            const records = parseRecordsFromPayloadList(rec.payloads);
            if (records.length === 0) continue;
            violations.push(
                buildWindowedViolation(rule, account, records, {
                    actual_value: Number(rec.txn_cnt),
                    threshold: 3,
                })
            );
        }
        return violations;
    }

    private async runDormantReactivation(rule: Rule, scale: number): Promise<ViolationResult[]> {
        const gapThresh = dormancyStepGapThreshold(scale);
        const sql = `
      WITH ordered AS (
        SELECT
          ${NORM_TABLE}.account AS account,
          ${NORM_TABLE}.step AS step,
          ${NORM_TABLE}.amount AS amount,
          ${NORM_TABLE}.payload AS payload,
          lag(${NORM_TABLE}.step) OVER (PARTITION BY ${NORM_TABLE}.account ORDER BY ${NORM_TABLE}.step) AS prev_step
        FROM ${NORM_TABLE}
        WHERE ${NORM_TABLE}.account IS NOT NULL AND CAST(${NORM_TABLE}.account AS VARCHAR) <> ''
      )
      SELECT o.account, o.step, o.amount, o.payload, o.prev_step
      FROM ordered o
      WHERE o.prev_step IS NOT NULL
        AND (o.step - o.prev_step) >= ${gapThresh}
        AND o.amount > 5000
    `;
        const rows = await allAsync(this.conn, sql);
        const violations: ViolationResult[] = [];
        for (const row of rows) {
            const rec = row as Record<string, unknown>;
            const account = String(rec.account ?? '');
            const record = parseRecordsFromPayloadList([rec.payload])[0];
            if (!record) continue;
            const gap = Number(rec.step) - Number(rec.prev_step);
            const daysDormant = Math.round(gap * (scale === 24 ? 1 : 1));
            violations.push(
                buildWindowedViolation(rule, account, [record], {
                    actual_value: record.amount,
                    threshold: 5000,
                    amount: record.amount,
                    daysDormant,
                    daysSince: 1,
                })
            );
        }
        return violations;
    }

    dispose(): void | Promise<void> {
        return new Promise((resolve, reject) => {
            this.conn.close((cErr) => {
                if (cErr) {
                    reject(cErr);
                    return;
                }
                this.db.close((dErr) => (dErr ? reject(dErr) : resolve()));
            });
        });
    }
}
