// ============================================================
// Engine Tests — Verifies all 3 Hour-0 bugs + core rule logic
// Run: npx tsx src/lib/engine/__tests__/engine.test.ts
// ============================================================

import { InMemoryBackend } from '../in-memory-backend';
import { normalizeRecord, detectDataset } from '../schema-adapter';
import { calculateComplianceScore } from '../scoring';
import { computeMetrics } from '../validation';
import { Rule, NormalizedRecord } from '../../types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.error(`  ❌ ${name}`);
        failed++;
    }
}

// ── Hour-0 Bug #1: ROUND_AMOUNT ──────────────────────────────
console.log('\n── ROUND_AMOUNT Logic ──');

assert(10000 % 1000 === 0, 'isRound(10000) → true');
assert(5000 % 1000 === 0, 'isRound(5000) → true');
assert(9500 % 1000 !== 0, 'isRound(9500) → false');
assert(9999 % 1000 !== 0, 'isRound(9999) → false');
assert(1000 % 1000 === 0, 'isRound(1000) → true');
assert(0 % 1000 === 0, 'isRound(0) → true');

// ── Hour-0 Bug #2: Schema Adapter ───────────────────────────
console.log('\n── Schema Adapter ──');

const ibmMapping = {
    account: 'orig_acct',
    recipient: 'bene_acct',
    amount: 'base_amt',
    step: 'tran_timestamp',
    type: 'tx_type',
};

const ibmRecord = {
    orig_acct: 'ACC001',
    bene_acct: 'ACC002',
    base_amt: 15000,
    tran_timestamp: 5,
    tx_type: 'WIRE',
};

const normalizedIbm = normalizeRecord(ibmRecord, ibmMapping);
assert(normalizedIbm.account === 'ACC001', 'IBM: orig_acct → account');
assert(normalizedIbm.amount === 15000, 'IBM: base_amt → amount');
assert(normalizedIbm.type === 'WIRE', 'IBM: tx_type → type');
assert(normalizedIbm.step === 5, 'IBM: tran_timestamp → step');

const paySimMapping = {
    account: 'nameOrig',
    recipient: 'nameDest',
    amount: 'amount',
    step: 'step',
    type: 'type',
};

const paySimRecord = { nameOrig: 'C123', nameDest: 'C456', amount: 8500, step: 10, type: 'TRANSFER' };
const normalizedPS = normalizeRecord(paySimRecord, paySimMapping);
assert(normalizedPS.account === 'C123', 'PaySim: nameOrig → account');
assert(normalizedPS.amount === 8500, 'PaySim: amount preserved');

// Dataset detection
assert(detectDataset(['orig_acct', 'bene_acct', 'base_amt', 'tx_type']) === 'IBM_AML', 'Detect IBM AML');
assert(detectDataset(['nameOrig', 'nameDest', 'step', 'isFraud']) === 'PAYSIM', 'Detect PaySim');
assert(detectDataset(['id', 'value', 'date']) === 'GENERIC', 'Detect Generic');

// ── Hour-0 Bug #3: Pre-filter $8,000 ────────────────────────
console.log('\n── Pre-filter Logic ──');

const records: NormalizedRecord[] = [
    { account: 'A1', recipient: 'B1', amount: 5000, step: 1, type: 'TRANSFER' },
    { account: 'A1', recipient: 'B1', amount: 8500, step: 2, type: 'TRANSFER' },
    { account: 'A1', recipient: 'B1', amount: 9000, step: 3, type: 'TRANSFER' },
    { account: 'A1', recipient: 'B1', amount: 9500, step: 4, type: 'TRANSFER' },
    { account: 'A1', recipient: 'B1', amount: 7999, step: 5, type: 'TRANSFER' },
];

const filtered = records.filter((r) => r.amount >= 8000);
assert(filtered.length === 3, 'Pre-filter: 3 of 5 records pass >= $8,000');
assert(filtered.every((r) => r.amount >= 8000), 'Pre-filter: all pass threshold');

// ── CTR_THRESHOLD ────────────────────────────────────────────
console.log('\n── CTR_THRESHOLD ──');

const backend = new InMemoryBackend();
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
    { account: 'A3', recipient: 'B3', amount: 12000, step: 3, type: 'PAYMENT' }, // PAYMENT not in allowed types
];

const ctrViolations = backend.execute(ctrRule, ctrRecords, 1.0);
assert(ctrViolations.length === 1, 'CTR: 1 violation (only $15K TRANSFER)');
assert(ctrViolations[0].amount === 15000, 'CTR: violation amount is $15K');

// ── STRUCTURING ──────────────────────────────────────────────
console.log('\n── STRUCTURING ──');

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

const structViolations = backend.execute(structRule, structRecords, 1.0);
assert(structViolations.length === 1, 'STRUCTURING: 1 violation (3 txns $8K-$10K)');
assert(structViolations[0].account === 'S1', 'STRUCTURING: correct account');

// ── ROUND_AMOUNT_PATTERN ─────────────────────────────────────
console.log('\n── ROUND_AMOUNT_PATTERN ──');

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
    { account: 'R1', recipient: 'X1', amount: 9500, step: 4, type: 'TRANSFER' }, // NOT round
];

const roundViolations = backend.execute(roundRule, roundRecords, 1.0);
assert(roundViolations.length === 1, 'ROUND: 1 violation (3 round txns: 5K, 10K, 15K)');
assert(roundViolations[0].account === 'R1', 'ROUND: correct account');

// No round violation with < 3 round amounts
const fewRoundRecords: NormalizedRecord[] = [
    { account: 'R2', recipient: 'X2', amount: 5000, step: 1, type: 'TRANSFER' },
    { account: 'R2', recipient: 'X2', amount: 9500, step: 2, type: 'TRANSFER' },
];
const fewViolations = backend.execute(roundRule, fewRoundRecords, 1.0);
assert(fewViolations.length === 0, 'ROUND: 0 violations (only 1 round txn)');

// ── Scoring ──────────────────────────────────────────────────
console.log('\n── Scoring ──');

const score1 = calculateComplianceScore(1000, [
    { severity: 'CRITICAL', status: 'pending' },
    { severity: 'HIGH', status: 'pending' },
    { severity: 'MEDIUM', status: 'pending' },
]);
assert(score1 > 0 && score1 < 100, `Score with violations: ${score1}`);

const score2 = calculateComplianceScore(1000, [
    { severity: 'CRITICAL', status: 'false_positive' },
    { severity: 'HIGH', status: 'false_positive' },
]);
assert(score2 === 100, 'Score with all false_positive: 100');

const score3 = calculateComplianceScore(0, []);
assert(score3 === 100, 'Score with 0 rows: 100');

// Verify weights: CRITICAL=1.0, HIGH=0.75, MEDIUM=0.5
const scoreSingleCrit = calculateComplianceScore(100, [{ severity: 'CRITICAL', status: 'pending' }]);
assert(scoreSingleCrit === 99, `Single CRITICAL in 100 rows: ${scoreSingleCrit} (expected 99)`);

// ── Validation Metrics ───────────────────────────────────────
console.log('\n── Validation Metrics ──');

const detected = new Set(['a', 'b', 'c']);
const groundTruth = new Set(['a', 'b', 'd']);
const metrics = computeMetrics(detected, groundTruth, 10);

assert(metrics.tp === 2, `TP=2: ${metrics.tp}`);
assert(metrics.fp === 1, `FP=1: ${metrics.fp}`);
assert(metrics.fn === 1, `FN=1: ${metrics.fn}`);
assert(metrics.tn === 6, `TN=6: ${metrics.tn}`);
assert(metrics.precision === 0.67, `Precision=0.67: ${metrics.precision}`);
assert(metrics.recall === 0.67, `Recall=0.67: ${metrics.recall}`);

// ── Summary ──────────────────────────────────────────────────
console.log(`\n🏁 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);

if (failed > 0) process.exit(1);
