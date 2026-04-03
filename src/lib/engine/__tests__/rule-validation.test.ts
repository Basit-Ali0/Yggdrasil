// ============================================================
// Rule validation unit tests
// Run: npx tsx src/lib/engine/__tests__/rule-validation.test.ts
// ============================================================

import { validateRuleForExecution, canonicalizeOperator } from '../rule-validation';
import type { Rule } from '../../types';
import { AML_RULES } from '../../policies/aml';
import { GDPR_RULES } from '../../policies/gdpr';
import { SOC2_RULES } from '../../policies/soc2';

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

console.log('\n── canonicalizeOperator ──');
assert(canonicalizeOperator('gte') === '>=', 'gte → >=');
assert(canonicalizeOperator('between') === 'BETWEEN', 'between → BETWEEN');
assert(canonicalizeOperator('nope') === null, 'unknown → null');

console.log('\n── AML prebuilt rules ──');
for (const r of AML_RULES) {
    const v = validateRuleForExecution(r);
    assert(v.valid, `${r.rule_id} executable`);
}

console.log('\n── GDPR prebuilt rules ──');
for (const r of GDPR_RULES) {
    const v = validateRuleForExecution(r);
    assert(v.valid, `${r.rule_id} executable`);
}

console.log('\n── SOC2 prebuilt rules ──');
for (const r of SOC2_RULES) {
    const v = validateRuleForExecution(r);
    assert(v.valid, `${r.rule_id} executable`);
}

console.log('\n── Generic rule validation ──');
const goodGeneric: Rule = {
    rule_id: 'GDPR_SCORE',
    name: 'Score',
    type: 'generic_check',
    severity: 'HIGH',
    threshold: null,
    time_window: null,
    conditions: { field: 'amount', operator: '>=', value: 100 },
    policy_excerpt: 'x',
    policy_section: 'y',
    is_active: true,
};
assert(validateRuleForExecution(goodGeneric).valid, 'generic >= numeric');

const badOp: Rule = {
    ...goodGeneric,
    rule_id: 'BAD_OP',
    conditions: { field: 'amount', operator: 'magic_compare', value: 1 },
};
assert(!validateRuleForExecution(badOp).valid, 'reject unknown operator');

const badBetween: Rule = {
    ...goodGeneric,
    rule_id: 'BAD_BETWEEN',
    conditions: { field: 'amount', operator: 'BETWEEN', value: [1] },
};
assert(!validateRuleForExecution(badBetween).valid, 'reject BETWEEN with one bound');

const missingField: Rule = {
    ...goodGeneric,
    rule_id: 'NO_FIELD',
    conditions: { field: '  ', operator: '>=', value: 1 },
};
assert(!validateRuleForExecution(missingField).valid, 'reject blank field for generic');

const badSeverity: Rule = {
    ...goodGeneric,
    rule_id: 'BAD_SEV',
    severity: 'LOW' as Rule['severity'],
};
assert(!validateRuleForExecution(badSeverity).valid, 'reject invalid severity');

console.log(`\n🏁 Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
