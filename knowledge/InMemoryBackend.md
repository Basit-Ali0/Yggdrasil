# In-Memory Execution Backend

**Project:** PolicyGuard AI  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../../gist.md](../../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [RuleEngine.md](./RuleEngine.md) - Interface definition
- [enforcement-spec.md](../enforcement-spec.md) - Rule specifications
- [explainability.md](../explainability.md) - Explanation templates

---

## Overview

Default execution backend for MVP. Processes rules by iterating over in-memory dataset.

**Characteristics:**
- Simple: ~100 lines of code
- Fast: No I/O overhead
- Deterministic: Same input → Same output
- Sufficient: Handles up to ~100K records in memory

---

## Implementation

```typescript
import { ExecutionBackend, Rule, Dataset, Violation } from './RuleEngine';

export class InMemoryBackend implements ExecutionBackend {
  name = 'in-memory';
  
// Rules that require account-level aggregation across a time window
// WARNING: Do NOT route by timeWindow value — STRUCTURING, VELOCITY, and SAR 
// rules all use 24hr windows but require account grouping, not single-tx checks.
// Route by rule.type instead.
const WINDOWED_RULE_TYPES = [
  'structuring',
  'velocity_limit', 
  'sar_velocity',
  'ctr_aggregation',
  'sub_threshold_velocity',
  'dormant_reactivation',
  'round_amount'
];

execute(rule: Rule, dataset: Dataset): Violation[] {
    const violations: Violation[] = [];
    
    const isWindowed = WINDOWED_RULE_TYPES.includes(rule.type);
    
    if (isWindowed) {
      // Group records by account and evaluate across the window
      const grouped = this.groupByAccount(dataset);
      const windowedViolations = this.checkWindowedRule(rule, grouped);
      violations.push(...windowedViolations);
    } else {
      // Single-transaction rules: evaluate each record independently
      for (const record of dataset.records) {
        if (this.checkRule(rule, record)) {
          violations.push(this.createViolation(rule, record));
        }
      }
    }
    
    return violations;
  }
  
  private checkRule(rule: Rule, record: Record): boolean {
    for (const condition of rule.conditions) {
      const value = record[condition.field];
      
      switch (condition.operator) {
        case '>=':
          if ((value as number) < (condition.value as number)) return false;
          break;
        case '<=':
          if ((value as number) > (condition.value as number)) return false;
          break;
        case '==':
          if (value !== condition.value) return false;
          break;
        case '!=':
          if (value === condition.value) return false;
          break;
        case 'IN':
          if (!condition.value.includes(value)) return false;
          break;
        case 'BETWEEN':
          if (value < condition.value[0] || value > condition.value[1]) return false;
          break;
      }
    }
    return true;
  }
  
  private groupByAccount(dataset: Dataset): Map<string, Record[]> {
    const groups = new Map<string, Record[]>();
    
    for (const record of dataset.records) {
      const account = record.nameOrig || record.orig_acct || record.account;
      if (!account) continue;
      
      if (!groups.has(account)) {
        groups.set(account, []);
      }
      groups.get(account)!.push(record);
    }
    
    return groups;
  }
  
  private checkWindowedRule(rule: Rule, grouped: Map<string, Record[]>): Violation[] {
    const violations: Violation[] = [];
    
    for (const [account, records] of grouped) {
      switch (rule.type) {
        case 'structuring':
          if (this.checkStructuring(records, rule)) {
            violations.push(this.createWindowedViolation(rule, account, records));
          }
          break;
        case 'velocity_limit':
          if (this.checkVelocity(records, rule)) {
            violations.push(this.createWindowedViolation(rule, account, records));
          }
          break;
        // Add more windowed rule types...
      }
    }
    
    return violations;
  }
  
  private checkStructuring(records: Record[], rule: Rule): boolean {
    // Count transactions between $8K and $10K
    const subThreshold = records.filter(r => {
      const amount = r.amount || r.base_amt;
      return amount >= 8000 && amount < 10000;
    });
    
    return subThreshold.length >= 3;
  }
  
  private checkVelocity(records: Record[], rule: Rule): boolean {
    const threshold = rule.threshold || 25000;
    const total = records.reduce((sum, r) => sum + (r.amount || r.base_amt || 0), 0);
    return total > threshold;
  }
  
  private createViolation(rule: Rule, record: Record): Violation {
    return {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      recordId: record.step ? `${record.step}_${record.nameOrig}` : record.id,
      account: record.nameOrig || record.orig_acct,
      amount: record.amount || record.base_amt,
      transactionType: record.type || record.tx_type,
      evidence: record,
      threshold: rule.threshold,
      policyExcerpt: rule.policyExcerpt,
      explanation: this.generateExplanation(rule, record),
      status: 'pending',
    };
  }
  
  private createWindowedViolation(rule: Rule, account: string, records: Record[]): Violation {
    const total = records.reduce((sum, r) => sum + (r.amount || r.base_amt || 0), 0);
    
    return {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      account,
      amount: total,
      evidence: { account, records, count: records.length },
      threshold: rule.threshold,
      policyExcerpt: rule.policyExcerpt,
      explanation: this.generateWindowedExplanation(rule, account, records),
      status: 'pending',
    };
  }
  
  private generateExplanation(rule: Rule, record: Record): string {
    const amount = record.amount || record.base_amt;
    
    switch (rule.id) {
      case 'CTR_THRESHOLD':
        return `Transaction of $${amount.toLocaleString()} exceeds $10,000 CTR threshold`;
      case 'BALANCE_MISMATCH':
        return `Balance change does not match transaction amount`;
      case 'FRAUD_INDICATOR':
        return `Transaction to account with zero prior balance`;
      default:
        return `Transaction triggered ${rule.name}`;
    }
  }
  
  private generateWindowedExplanation(rule: Rule, account: string, records: Record[]): string {
    const total = records.reduce((sum, r) => sum + (r.amount || r.base_amt || 0), 0);
    
    switch (rule.type) {
      case 'structuring':
        return `Account ${account}: ${records.length} transactions between $8K-$10K (potential structuring)`;
      case 'velocity_limit':
        return `Account ${account}: $${total.toLocaleString()} in transactions exceeds $${rule.threshold?.toLocaleString()} limit`;
      default:
        return `Account ${account} triggered ${rule.name}`;
    }
  }
}
```

---

## Supported Rule Types

| Rule Type | Support | Notes |
|-----------|---------|-------|
| ctr_threshold | ✅ Full | Single transaction check |
| structuring | ✅ Full | Windowed: counts sub-$10K transactions |
| velocity_limit | ✅ Full | Windowed: sums amounts |
| balance_mismatch | ✅ Full | Compares balance changes |
| round_amount | ✅ Full | Checks for round-dollar patterns |
| dormant_reactivation | ✅ Full | Checks account history |
| sar_threshold | ✅ Full | Single transaction |
| sar_velocity | ✅ Full | Windowed |

---

## Schema Mapping

Different datasets have different column names. The backend handles this:

| Concept | IBM AML | PaySim | Generic |
|---------|---------|--------|---------|
| Account (sender) | orig_acct | nameOrig | account |
| Account (receiver) | bene_acct | nameDest | recipient |
| Amount | base_amt | amount | amount |
| Time | tran_timestamp | step | timestamp |
| Type | tx_type | type | transaction_type |

```typescript
// Normalize record to common schema
function normalizeRecord(record: Record, source: string): Record {
  if (source === 'ibm_aml') {
    return {
      account: record.orig_acct,
      recipient: record.bene_acct,
      amount: record.base_amt,
      timestamp: record.tran_timestamp,
      transactionType: record.tx_type,
    };
  }
  if (source === 'paysim') {
    return {
      account: record.nameOrig,
      recipient: record.nameDest,
      amount: record.amount,
      timestamp: record.step,
      transactionType: record.type,
    };
  }
  return record;
}
```

---

## Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Memory bound | Can't handle GB-sized files | Stream processing (future) |
| No parallelization | Slower on large datasets | Worker threads (future) |
| Simple aggregations | Complex patterns limited | Pre-aggregate in query |

---

## Performance

| Dataset Size | Expected Time |
|--------------|---------------|
| 1,000 records | <100ms |
| 10,000 records | <500ms |
| 100,000 records | <3s |
| 1,000,000 records | ~30s (may timeout) |

For the hackathon:
- IBM AML Small: ~3M records → Use filtering first
- PaySim: 6.3M records → Sample or filter

---

## Testing

```typescript
// Unit test example
const backend = new InMemoryBackend();

const rule: Rule = {
  id: 'CTR_THRESHOLD',
  name: 'CTR Threshold',
  type: 'ctr_threshold',
  threshold: 10000,
  severity: 'CRITICAL',
  conditions: [
    { field: 'amount', operator: '>=', value: 10000 }
  ],
  policyExcerpt: 'Report transactions over $10,000',
};

const dataset: Dataset = {
  records: [
    { amount: 5000, nameOrig: 'A' },
    { amount: 15000, nameOrig: 'B' },
    { amount: 25000, nameOrig: 'C' },
  ],
  schema: { columns: [] },
  source: 'csv',
  recordCount: 3,
};

const violations = backend.execute(rule, dataset);
expect(violations).toHaveLength(2); // B and C
```
