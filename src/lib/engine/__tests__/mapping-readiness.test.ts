// ============================================================
// Mapping readiness tests (P1-22)
// Run: npx tsx src/lib/engine/__tests__/mapping-readiness.test.ts
// ============================================================

import {
    evaluateMappingReadiness,
    requiredNormalizedFieldsForRules,
    effectiveCsvColumn,
} from '../mapping-readiness';
import type { Rule } from '../../types';
import { AML_RULES } from '../../policies/aml';

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

const paySimMapping = {
    account: 'nameOrig',
    recipient: 'nameDest',
    amount: 'amount',
    step: 'step',
    type: 'type',
};

const paySimHeaders = ['nameOrig', 'nameDest', 'amount', 'step', 'type', 'isFraud'];

console.log('\n── effectiveCsvColumn ──');
assert(effectiveCsvColumn(paySimMapping, 'amount') === 'amount', 'mapped amount');
assert(effectiveCsvColumn({}, 'account') === 'account', 'fallback to logical name');

console.log('\n── AML pack required fields (all active) ──');
const amlRequired = requiredNormalizedFieldsForRules(AML_RULES);
assert(amlRequired.has('account'), 'needs account');
assert(amlRequired.has('amount'), 'needs amount');
assert(amlRequired.has('recipient'), 'needs recipient (CTR aggregation)');
assert(amlRequired.has('oldbalanceOrg'), 'needs balance (BALANCE_MISMATCH)');

console.log('\n── PaySim + full AML: blocked without balance columns ──');
const r1 = evaluateMappingReadiness({
    rules: AML_RULES,
    mapping: paySimMapping,
    headers: paySimHeaders,
    sampleRows: [{ nameOrig: 'a', nameDest: 'b', amount: 100, step: 1, type: 'T' }],
});
assert(r1.state === 'blocked', 'blocked when balance fields unmapped/invalid');
assert(
    r1.missing_required.includes('oldbalanceOrg') ||
        r1.invalid_columns.some((i) => i.includes('oldbalanceOrg')),
    'flags oldbalanceOrg',
);

console.log('\n── Deactivate balance + fraud rules: can be ready ──');
const trimmed = AML_RULES.map((r) =>
    ['BALANCE_MISMATCH', 'FRAUD_INDICATOR'].includes(r.rule_id)
        ? { ...r, is_active: false }
        : r,
);
const r2 = evaluateMappingReadiness({
    rules: trimmed,
    mapping: paySimMapping,
    headers: paySimHeaders,
    sampleRows: [{ nameOrig: 'a', nameDest: 'b', amount: 100, step: 1, type: 'T' }],
});
assert(r2.state === 'ready', 'ready without balance rules');

console.log('\n── Invalid header target ──');
const r3 = evaluateMappingReadiness({
    rules: trimmed,
    mapping: { ...paySimMapping, amount: 'not_a_column' },
    headers: paySimHeaders,
    sampleRows: [],
});
assert(r3.state === 'blocked', 'blocked for bogus column');
assert(r3.invalid_columns.length > 0, 'reports invalid column');

console.log('\n── Generic rule normalized field ──');
const generic: Rule = {
    rule_id: 'CUSTOM',
    name: 'Custom',
    type: 'custom',
    severity: 'MEDIUM',
    threshold: null,
    time_window: null,
    conditions: { field: 'recipient', operator: '>=', value: 0 },
    policy_excerpt: 'x',
    policy_section: 'y',
    is_active: true,
};
const r4 = evaluateMappingReadiness({
    rules: [generic],
    mapping: { account: 'nameOrig', amount: 'amount', step: 'step', type: 'type' },
    headers: paySimHeaders,
    sampleRows: [],
});
assert(
    r4.missing_required.includes('recipient') ||
        r4.invalid_columns.some((i) => i.includes('recipient')),
    'generic normalized field required',
);

console.log('\n── Custom amount rule: not blocked when step/type absent from headers ──');
const customAmountRule: Rule = {
    rule_id: 'CUSTOM_THRESHOLD',
    name: 'Large Transfer',
    type: 'custom',
    severity: 'HIGH',
    threshold: 10000,
    time_window: null,
    conditions: { field: 'amount', operator: '>=', value: 10000 },
    policy_excerpt: 'transfers over $10k must be reviewed',
    policy_section: '4.1',
    is_active: true,
};
// Dataset that only has account + amount — no step, type, balance columns
const r5 = evaluateMappingReadiness({
    rules: [customAmountRule],
    mapping: { account: 'user_id', amount: 'txn_amt' },
    headers: ['user_id', 'txn_amt'],
    sampleRows: [{ user_id: 'U1', txn_amt: 50000 }],
});
assert(
    r5.state === 'ready',
    'custom amount-only rule ready without step/type columns',
);
assert(!r5.missing_required.includes('step'), 'step not required for custom amount rule');
assert(!r5.missing_required.includes('type'), 'type not required for custom amount rule');

console.log('\n── Custom rule with non-normalized condition field: warning only ──');
const customNonNormRule: Rule = {
    rule_id: 'CUSTOM_RISK_SCORE',
    name: 'High Risk Score',
    type: 'custom',
    severity: 'MEDIUM',
    threshold: 80,
    time_window: null,
    conditions: { field: 'risk_score', operator: '>=', value: 80 },
    policy_excerpt: 'x',
    policy_section: 'y',
    is_active: true,
};
const r6 = evaluateMappingReadiness({
    rules: [customNonNormRule],
    mapping: { account: 'cust_id' },
    headers: ['cust_id', 'risk_score'],
    sampleRows: [],
});
// Non-normalized field without explicit mapping to a bad column → warning, not blocked
assert(r6.state !== 'blocked' || r6.invalid_columns.length > 0, 'non-normalized unmapped field is warning not blocked');
assert(r6.warnings.some((w) => w.includes('risk_score')), 'warns about non-standard field');

console.log(`\n🏁 Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
