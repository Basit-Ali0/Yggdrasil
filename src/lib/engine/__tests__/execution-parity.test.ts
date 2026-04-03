// ============================================================
// Parity: InMemoryBackend vs DuckDbExecutionBackend
// Run: npx tsx src/lib/engine/__tests__/execution-parity.test.ts
// ============================================================

import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import duckdb, { type TableData } from 'duckdb';
import { InMemoryBackend } from '../in-memory-backend';
import { DuckDbExecutionBackend } from '../duckdb-backend';
import { normalizeRuleForEngine } from '../rule-engine-normalize';
import { normalizeRecord } from '../schema-adapter';
import { normalizedSelectExpressions } from '../duckdb-projection';
import type { Rule, NormalizedRecord } from '../../types';
import type { ViolationResult } from '../violation-result';

function fingerprint(v: ViolationResult): string {
    const amounts = (v.evidence as { amounts?: number[] })?.amounts;
    return [
        v.rule_id,
        v.record_id,
        v.account,
        v.amount,
        v.severity,
        v.actual_value,
        v.threshold,
        v.transaction_type,
        amounts !== undefined ? JSON.stringify(amounts) : '',
    ].join('|');
}

function assertParity(
    mem: ViolationResult[],
    duck: ViolationResult[],
    label: string
): void {
    const a = [...mem].map(fingerprint).sort().join('\n');
    const b = [...duck].map(fingerprint).sort().join('\n');
    if (a !== b) {
        console.error(`Parity mismatch: ${label}\nmemory:\n${a}\nduckdb:\n${b}`);
        throw new Error(`Parity failed: ${label}`);
    }
}

function allAsync(conn: duckdb.Connection, sql: string): Promise<TableData> {
    return new Promise((resolve, reject) => {
        conn.all(sql, (err, rows) => (err ? reject(err) : resolve(rows ?? [])));
    });
}

async function main() {
    const mem = new InMemoryBackend();
    const duck = new DuckDbExecutionBackend();

    const ctrRule: Rule = {
        rule_id: 'CTR_THRESHOLD',
        name: 'CTR Threshold',
        type: 'ctr_threshold',
        severity: 'CRITICAL',
        threshold: 10000,
        time_window: null,
        conditions: { field: 'amount', operator: '>=', value: 10000 },
        policy_excerpt: 'CTR exceeds $10K',
        policy_section: 'Section 1',
        is_active: true,
    };

    const ctrRecords: NormalizedRecord[] = [
        { account: 'A1', recipient: 'B1', amount: 5000, step: 1, type: 'WIRE' },
        { account: 'A2', recipient: 'B2', amount: 15000, step: 2, type: 'TRANSFER' },
        { account: 'A3', recipient: 'B3', amount: 12000, step: 3, type: 'PAYMENT' },
    ];

    const engineCtr = normalizeRuleForEngine(ctrRule);
    const memCtr = mem.execute(engineCtr, ctrRecords, 1.0);
    await duck.prepare(ctrRecords);
    const duckCtr = await duck.execute(engineCtr, ctrRecords, 1.0);
    assertParity(memCtr, duckCtr as ViolationResult[], 'CTR_THRESHOLD');

    await duck.dispose();

    // Generic >= condition
    const duck2 = new DuckDbExecutionBackend();
    const genericRule: Rule = {
        rule_id: 'CUSTOM_AMT',
        name: 'Custom',
        type: 'single_transaction',
        severity: 'MEDIUM',
        threshold: 9000,
        time_window: null,
        conditions: { field: 'amount', operator: '>=', value: 9000 },
        policy_excerpt: 'x',
        policy_section: 'y',
        is_active: true,
    };
    const genEngine = normalizeRuleForEngine(genericRule);
    const rows: NormalizedRecord[] = [
        { account: 'X', recipient: 'Y', amount: 8000, step: 1, type: 'T' },
        { account: 'X', recipient: 'Y', amount: 9500, step: 2, type: 'T' },
    ];
    const memG = mem.execute(genEngine, rows, 1.0);
    await duck2.prepare(rows);
    const duckG = await duck2.execute(genEngine, rows, 1.0);
    assertParity(memG, duckG as ViolationResult[], 'generic >=');
    await duck2.dispose();

    const scale = 1.0;

    const structRule: Rule = {
        rule_id: 'STRUCTURING_PATTERN',
        name: 'Structuring',
        type: 'structuring',
        severity: 'CRITICAL',
        threshold: 3,
        time_window: 24,
        conditions: { field: 'amount', operator: 'BETWEEN', value: [8000, 10000] },
        policy_excerpt: 'Structuring detected',
        policy_section: 'Section 2',
        is_active: true,
    };
    const structRecords: NormalizedRecord[] = [
        { account: 'S1', recipient: 'R1', amount: 8500, step: 1, type: 'TRANSFER' },
        { account: 'S1', recipient: 'R1', amount: 9000, step: 2, type: 'TRANSFER' },
        { account: 'S1', recipient: 'R1', amount: 9500, step: 3, type: 'TRANSFER' },
    ];
    const duck3 = new DuckDbExecutionBackend();
    const engStruct = normalizeRuleForEngine(structRule);
    const memStruct = mem.execute(engStruct, structRecords, scale);
    await duck3.prepare(structRecords);
    const duckStruct = (await duck3.execute(engStruct, structRecords, scale)) as ViolationResult[];
    assertParity(memStruct, duckStruct, 'STRUCTURING');
    await duck3.dispose();

    const roundRule: Rule = {
        rule_id: 'ROUND_AMOUNT_PATTERN',
        name: 'Round Amount',
        type: 'round_amount',
        severity: 'MEDIUM',
        threshold: 3,
        time_window: 720,
        conditions: { field: 'amount', operator: 'round_check', value: 1000 },
        policy_excerpt: 'Round amounts detected',
        policy_section: 'Section 4',
        is_active: true,
    };
    const roundRecords: NormalizedRecord[] = [
        { account: 'R1', recipient: 'X1', amount: 5000, step: 1, type: 'TRANSFER' },
        { account: 'R1', recipient: 'X1', amount: 10000, step: 2, type: 'TRANSFER' },
        { account: 'R1', recipient: 'X1', amount: 15000, step: 3, type: 'TRANSFER' },
    ];
    const duck4 = new DuckDbExecutionBackend();
    const engRound = normalizeRuleForEngine(roundRule);
    const memRound = mem.execute(engRound, roundRecords, scale);
    await duck4.prepare(roundRecords);
    const duckRound = (await duck4.execute(engRound, roundRecords, scale)) as ViolationResult[];
    assertParity(memRound, duckRound, 'ROUND_AMOUNT');
    await duck4.dispose();

    const sarRule: Rule = {
        rule_id: 'SAR_VELOCITY',
        name: 'SAR Velocity',
        type: 'sar_velocity',
        severity: 'HIGH',
        threshold: 25000,
        time_window: 24,
        conditions: { field: 'amount', operator: 'sum', value: 25000 },
        policy_excerpt: 'SAR velocity',
        policy_section: 'Section 3',
        is_active: true,
    };
    const sarRecords: NormalizedRecord[] = [
        { account: 'SV', recipient: 'R1', amount: 15000, step: 1, type: 'TRANSFER' },
        { account: 'SV', recipient: 'R2', amount: 15000, step: 2, type: 'TRANSFER' },
    ];
    const duck5 = new DuckDbExecutionBackend();
    const engSar = normalizeRuleForEngine(sarRule);
    const memSar = mem.execute(engSar, sarRecords, scale);
    await duck5.prepare(sarRecords);
    const duckSar = (await duck5.execute(engSar, sarRecords, scale)) as ViolationResult[];
    assertParity(memSar, duckSar, 'SAR_VELOCITY');
    await duck5.dispose();

    const ctrAggRule: Rule = {
        rule_id: 'CTR_AGGREGATION',
        name: 'CTR Aggregation',
        type: 'ctr_aggregation',
        severity: 'CRITICAL',
        threshold: 10000,
        time_window: 24,
        conditions: { field: 'amount', operator: 'sum', value: 10000 },
        policy_excerpt: 'CTR agg',
        policy_section: 'Section 1',
        is_active: true,
    };
    const ctrAggRecords: NormalizedRecord[] = [
        { account: 'CA', recipient: 'RX', amount: 6000, step: 1, type: 'WIRE' },
        { account: 'CA', recipient: 'RX', amount: 5000, step: 2, type: 'WIRE' },
    ];
    const duck6 = new DuckDbExecutionBackend();
    const engAgg = normalizeRuleForEngine(ctrAggRule);
    const memAgg = mem.execute(engAgg, ctrAggRecords, scale);
    await duck6.prepare(ctrAggRecords);
    const duckAgg = (await duck6.execute(engAgg, ctrAggRecords, scale)) as ViolationResult[];
    assertParity(memAgg, duckAgg, 'CTR_AGGREGATION');
    await duck6.dispose();

    const velRule: Rule = {
        rule_id: 'SUB_THRESHOLD_VELOCITY',
        name: 'Sub-threshold velocity',
        type: 'sub_threshold_velocity',
        severity: 'HIGH',
        threshold: 5,
        time_window: 24,
        conditions: { field: 'amount', operator: 'count', value: 5 },
        policy_excerpt: 'Velocity',
        policy_section: 'Section 2',
        is_active: true,
    };
    const velRecords: NormalizedRecord[] = Array.from({ length: 5 }, (_, i) => ({
        account: 'V5',
        recipient: 'R',
        amount: 8500,
        step: i + 1,
        type: 'TRANSFER',
    })) as NormalizedRecord[];
    const duck7 = new DuckDbExecutionBackend();
    const engVel = normalizeRuleForEngine(velRule);
    const memVel = mem.execute(engVel, velRecords, scale);
    await duck7.prepare(velRecords);
    const duckVel = (await duck7.execute(engVel, velRecords, scale)) as ViolationResult[];
    assertParity(memVel, duckVel, 'SUB_THRESHOLD_VELOCITY');
    await duck7.dispose();

    const dormantRule: Rule = {
        rule_id: 'DORMANT_ACCOUNT_REACTIVATION',
        name: 'Dormant',
        type: 'dormant_reactivation',
        severity: 'MEDIUM',
        threshold: 5000,
        time_window: 90,
        conditions: { field: 'step', operator: '>=', value: 90 },
        policy_excerpt: 'Dormant',
        policy_section: 'Section 4',
        is_active: true,
    };
    const dormantRecords: NormalizedRecord[] = [
        { account: 'D1', recipient: 'X', amount: 50, step: 0, type: 'TRANSFER' },
        { account: 'D1', recipient: 'X', amount: 6000, step: 100, type: 'TRANSFER' },
    ];
    const duck8 = new DuckDbExecutionBackend();
    const engDorm = normalizeRuleForEngine(dormantRule);
    const memDorm = mem.execute(engDorm, dormantRecords, scale);
    await duck8.prepare(dormantRecords);
    const duckDorm = (await duck8.execute(engDorm, dormantRecords, scale)) as ViolationResult[];
    assertParity(memDorm, duckDorm, 'DORMANT_REACTIVATION');
    await duck8.dispose();

    // Projection vs normalizeRecord (IBM-style mapping)
    const ibmMapping = {
        account: 'orig_acct',
        recipient: 'bene_acct',
        amount: 'base_amt',
        step: 'tran_timestamp',
        type: 'tx_type',
    };
    const rawRows = [
        {
            orig_acct: 'ACC001',
            bene_acct: 'ACC002',
            base_amt: 15000,
            tran_timestamp: 5,
            tx_type: 'WIRE',
            oldbalanceOrg: null,
            newbalanceOrig: null,
            oldbalanceDest: null,
            newbalanceDest: null,
        },
    ];
    const tmp = join(tmpdir(), `ygg-parity-${Date.now()}.json`);
    writeFileSync(tmp, JSON.stringify(rawRows));
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    const sel = normalizedSelectExpressions(ibmMapping, 'j');
    const sql = `SELECT ${sel} FROM read_json_auto('${tmp.replace(/\\/g, '/')}') AS j`;
    const projected = (await allAsync(conn, sql))[0] as Record<string, unknown>;
    unlinkSync(tmp);
    await new Promise<void>((resolve, reject) => {
        conn.close((cErr) => {
            if (cErr) {
                reject(cErr);
                return;
            }
            db.close((dErr) => (dErr ? reject(dErr) : resolve()));
        });
    });

    const norm = normalizeRecord(rawRows[0], ibmMapping);
    const eps = 1e-9;
    if (String(projected.account) !== norm.account) throw new Error('projection account');
    if (Math.abs(Number(projected.amount) - norm.amount) > eps) throw new Error('projection amount');
    if (Math.abs(Number(projected.step) - norm.step) > eps) throw new Error('projection step');
    if (String(projected.type) !== norm.type) throw new Error('projection type');

    // prepareRaw parity: DuckDB projects via JSON path, result matches normalizeRecord
    // CTR_THRESHOLD fires for amount >= 10000 AND type IN [WIRE, CASH_OUT, TRANSFER, ...]
    // rawRows[0] has base_amt=15000 and tx_type='WIRE' → should produce 1 violation
    const duck9 = new DuckDbExecutionBackend();
    await (duck9 as any).prepareRaw([rawRows[0]], ibmMapping);
    const duckRawViolations = (await duck9.execute(
        normalizeRuleForEngine({
            rule_id: 'CTR_THRESHOLD',
            name: 'CTR Threshold',
            type: 'ctr_threshold',
            severity: 'CRITICAL',
            threshold: 10000,
            time_window: null,
            conditions: { field: 'amount', operator: '>=', value: 10000 },
            policy_excerpt: 'x',
            policy_section: 'y',
            is_active: true,
        }),
        [],
        1
    )) as ViolationResult[];
    if (duckRawViolations.length !== 1) throw new Error(`prepareRaw: expected 1 violation but got ${duckRawViolations.length}`);
    if (duckRawViolations[0].account !== 'ACC001') throw new Error(`prepareRaw: account mismatch (got ${duckRawViolations[0].account})`);
    if (Math.abs(duckRawViolations[0].amount - 15000) > 1e-9) throw new Error(`prepareRaw: amount mismatch (got ${duckRawViolations[0].amount})`);
    await duck9.dispose();
    console.log('  ✅ prepareRaw: JSON-path projection produces correct violation');

    console.log('execution-parity: all checks passed');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
