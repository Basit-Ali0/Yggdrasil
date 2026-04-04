// ============================================================
// Unit tests for case generation logic (P3-03/P3-04/P3-05/P3-24)
// Run: npx tsx src/lib/engine/__tests__/case-generation.test.ts
// ============================================================

import {
    generateCases,
    deriveSubjectKey,
    isAmlPolicyType,
    type ViolationForCase,
} from '../../case-generation';

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string) {
    if (cond) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.error(`  ❌ ${name}`);
        failed++;
    }
}

let nextId = 0;
function mockViolation(overrides: Partial<ViolationForCase> = {}): ViolationForCase {
    return {
        id: `v-${nextId++}`,
        rule_id: 'CTR_THRESHOLD',
        rule_name: 'Currency Transaction Report Threshold',
        severity: 'HIGH',
        account: 'ACCT-001',
        amount: 15000,
        ...overrides,
    };
}

// ── deriveSubjectKey ──
console.log('\n── deriveSubjectKey ──');
assert(deriveSubjectKey(mockViolation({ account: 'ACCT-123' })) === 'ACCT-123', 'uses account when present');
assert(deriveSubjectKey(mockViolation({ account: '', record_id: 'REC-1' })) === 'REC-1', 'falls back to record_id');
assert(deriveSubjectKey(mockViolation({ account: '-', record_id: 'REC-2' })) === 'REC-2', 'falls back when account is dash');

const noAccount = mockViolation({ account: '', record_id: undefined });
assert(deriveSubjectKey(noAccount) === noAccount.id, 'falls back to violation id');

// ── generateCases ──
console.log('\n── generateCases ──');

const grouped = generateCases([
    mockViolation({ account: 'ACCT-001', amount: 10000, severity: 'HIGH' }),
    mockViolation({ account: 'ACCT-001', amount: 5000, severity: 'MEDIUM' }),
    mockViolation({ account: 'ACCT-002', amount: 20000, severity: 'CRITICAL' }),
]);
assert(grouped.length === 2, 'creates two cases for two accounts');

const acct1 = grouped.find((c) => c.subject_key === 'ACCT-001');
assert(!!acct1, 'ACCT-001 case exists');
assert(acct1!.violation_count === 2, 'ACCT-001 has 2 violations');
assert(acct1!.suspicious_amount === 15000, 'ACCT-001 total amount is 15000');
assert(acct1!.severity_rollup === 'HIGH', 'ACCT-001 severity rollup is HIGH');

const acct2 = grouped.find((c) => c.subject_key === 'ACCT-002');
assert(!!acct2, 'ACCT-002 case exists');
assert(acct2!.severity_rollup === 'CRITICAL', 'ACCT-002 severity rollup is CRITICAL');

// Priority sorting
const sorted = generateCases([
    mockViolation({ account: 'LOW', amount: 100, severity: 'MEDIUM' }),
    mockViolation({ account: 'HIGH', amount: 500000, severity: 'CRITICAL' }),
]);
assert(sorted[0].subject_key === 'HIGH', 'higher priority case comes first');
assert(sorted[0].priority_score > sorted[1].priority_score, 'scores are descending');

// Repeat subject boost
const withRepeat = generateCases(
    [
        mockViolation({ account: 'REPEAT', amount: 10000, severity: 'HIGH' }),
        mockViolation({ account: 'NEW', amount: 10000, severity: 'HIGH' }),
    ],
    new Set(['REPEAT'])
);
const repeatCase = withRepeat.find((c) => c.subject_key === 'REPEAT')!;
const newCase = withRepeat.find((c) => c.subject_key === 'NEW')!;
assert(repeatCase.priority_score > newCase.priority_score, 'repeat subjects get priority boost');

assert(generateCases([]).length === 0, 'empty violations produce empty cases');

// Counterparty counting (uses recipient, not transaction_type)
console.log('\n── counterparty counting ──');
const cpViolations = [
    mockViolation({ account: 'A', recipient: 'R1', transaction_type: 'WIRE' }),
    mockViolation({ account: 'A', recipient: 'R2', transaction_type: 'WIRE' }),
    mockViolation({ account: 'A', recipient: 'R1', transaction_type: 'TRANSFER' }),
    mockViolation({ account: 'A', recipient: undefined }),
];
const cpCases = generateCases(cpViolations);
assert(cpCases.length === 1, 'all grouped under same account');
assert(cpCases[0].counterparty_count === 2, 'counts 2 unique recipients (R1, R2), not transaction types');

// ── isAmlPolicyType ──
console.log('\n── isAmlPolicyType ──');
assert(isAmlPolicyType('aml') === true, 'aml returns true');
assert(isAmlPolicyType('gdpr') === false, 'gdpr returns false');
assert(isAmlPolicyType(null) === false, 'null returns false');
assert(isAmlPolicyType(undefined) === false, 'undefined returns false');

console.log(`\n🏁 Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
