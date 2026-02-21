# Enforcement Specification: Yggdrasil

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md).

**Related Docs:**
- [gist.md](../gist.md) - Project overview
- [policies/aml.md](./policies/aml.md) - AML policy rules
- [explainability.md](./explainability.md) - Explanation templates
- [evaluation.md](./evaluation.md) - Ground## Enforcement Approach truth metrics

---



**Selected: JavaScript/TypeScript in-memory filtering**

Rationale:
- Fastest to implement (10 rules ~50 lines)
- Easy debugging with console/breakpoints
- Built-in explainability generation
- Works natively on Vercel serverless
- Deterministic: same input → same output

---

## Rule → Enforcement Mapping

Each rule below defines: inputs, logic, window, and output format.

---

### Rule: CTR_THRESHOLD

**Description:** Flag transactions exceeding $10,000 (CTR reporting threshold)

**Inputs:**
- `amount` (number) - Transaction amount
- `type` (string) - Transaction type (WIRE, CASH_OUT, TRANSFER, etc.)

**Logic:**
```
IF amount >= 10000 AND type IN ['WIRE', 'CASH_OUT', 'TRANSFER', 'DEPOSIT']
THEN violation = TRUE
```

**Window:** Single transaction (no aggregation)

**Output:**
```json
{
  "rule_id": "CTR_THRESHOLD",
  "violation_id": "uuid",
  "transaction_id": "tran_id or step+nameOrig",
  "amount": 12500.00,
  "threshold": 10000,
  "type": "WIRE",
  "severity": "CRITICAL",
  "policy_reference": "Section 1: CTR Threshold"
}
```

---

### Rule: CTR_AGGREGATION

**Description:** Flag when multiple transactions to same person aggregate >$10,000 in single day

**Inputs:**
- `nameOrig` (string) - Sender account
- `nameDest` (string) - Recipient account  
- `amount` (number) - Transaction amount
- `step` (int) - Time step (1 step = 1 hour)

**Logic:**
```
GROUP BY nameOrig, nameDest, FLOOR(step / 24)
IF SUM(amount) >= 10000
THEN violation = TRUE
```

**Window:** 24 hours (24 steps)

**Output:**
```json
{
  "rule_id": "CTR_AGGREGATION",
  "violation_id": "uuid",
  "account_pair": "nameOrig → nameDest",
  "aggregate_amount": 12500.00,
  "transaction_count": 3,
  "time_window": "24 hours",
  "threshold": 10000,
  "severity": "CRITICAL",
  "policy_reference": "Section 1: CTR Aggregation"
}
```

---

### Rule: STRUCTURING_PATTERN

**Description:** Detect structuring/smurfing - multiple transactions $8K-$10K within 24 hours

**Inputs:**
- `nameOrig` (string) - Sender account
- `amount` (number) - Transaction amount
- `step` (int) - Time step

**Logic:**
```
IF nameOrig has >= 3 transactions
AND ALL amounts BETWEEN 8000 AND 10000
AND MAX(step) - MIN(step) <= 24
THEN violation = TRUE
```

**Window:** 24 hours (24 steps)

**Output:**
```json
{
  "rule_id": "STRUCTURING_PATTERN",
  "violation_id": "uuid",
  "account": "nameOrig",
  "transaction_count": 3,
  "individual_amounts": [9500, 9800, 9200],
  "total_amount": 28500.00,
  "time_window": "24 hours",
  "severity": "CRITICAL",
  "policy_reference": "Section 2: Structuring Detection"
}
```

---

### Rule: SUB_THRESHOLD_VELOCITY

**Description:** Flag 5+ sub-threshold transactions ($8K-$10K) in 24 hours

**Inputs:**
- `nameOrig` (string) - Sender account
- `amount` (number) - Transaction amount
- `step` (int) - Time step

**Logic:**
```
IF COUNT(transactions WHERE amount >= 8000 AND amount < 10000) >= 5
AND MAX(step) - MIN(step) <= 24
THEN violation = TRUE
```

**Window:** 24 hours

**Output:**
```json
{
  "rule_id": "SUB_THRESHOLD_VELOCITY",
  "violation_id": "uuid",
  "account": "nameOrig",
  "transaction_count": 5,
  "amount_range": "$8,000 - $10,000",
  "time_window": "24 hours",
  "severity": "HIGH",
  "policy_reference": "Section 2: Sub-Threshold Velocity"
}
```

---

### Rule: SAR_THRESHOLD

**Description:** Flag transactions >=$5K with suspicious patterns

**Inputs:**
- `amount` (number) - Transaction amount
- `type` (string) - Transaction type
- `nameOrig` (string) - Sender account

**Logic:**
```
IF amount >= 5000
AND (type IN ['WIRE', 'TRANSFER'] OR has_velocity_violation OR has_structuring)
THEN flag_for_review = TRUE
```

**Window:** Single transaction + pattern context

**Output:**
```json
{
  "rule_id": "SAR_THRESHOLD",
  "violation_id": "uuid",
  "transaction_id": "step+nameOrig",
  "amount": 7500.00,
  "threshold": 5000,
  "trigger": "amount + velocity_pattern",
  "severity": "HIGH",
  "policy_reference": "Section 3: SAR Threshold"
}
```

---

### Rule: SAR_VELOCITY

**Description:** Flag accounts with >$25K in 24-hour period

**Inputs:**
- `nameOrig` (string) - Sender account
- `amount` (number) - Transaction amount
- `step` (int) - Time step

**Logic:**
```
GROUP BY nameOrig, FLOOR(step / 24)
IF SUM(amount) > 25000
THEN violation = TRUE
```

**Window:** 24 hours (24 steps)

**Output:**
```json
{
  "rule_id": "SAR_VELOCITY",
  "violation_id": "uuid",
  "account": "nameOrig",
  "total_amount": 28500.00,
  "transaction_count": 8,
  "time_window": "24 hours",
  "threshold": 25000,
  "severity": "HIGH",
  "policy_reference": "Section 3: SAR Velocity"
}
```

---

### Rule: DORMANT_ACCOUNT_REACTIVATION

**Description:** Flag high-value transactions from dormant accounts

**Inputs:**
- `nameOrig` (string) - Sender account
- `amount` (number) - Transaction amount
- `step` (int) - Time step
- Account history (prior transactions)

**Logic:**
```
IF account has NO transactions > $100 in past 90 steps
AND current transaction amount > 5000
AND time_since_last_transaction <= 30
THEN violation = TRUE
```

**Window:** 90 days dormant + 30 days reactivation

**Output:**
```json
{
  "rule_id": "DORMANT_ACCOUNT_REACTIVATION",
  "violation_id": "uuid",
  "account": "nameOrig",
  "amount": 7500.00,
  "days_dormant": 95,
  "days_since_reactivation": 5,
  "severity": "MEDIUM",
  "policy_reference": "Section 4: Dormant Account Reactivation"
}
```

---

### Rule: BALANCE_MISMATCH

**Description:** Flag transactions where balance change doesn't match amount

**Inputs:**
- `amount` (number) - Transaction amount
- `oldbalanceOrg` (number) - Sender balance before
- `newbalanceOrig` (number) - Sender balance after

**Logic:**
```
IF abs((oldbalanceOrg + amount) - newbalanceOrig) > 0.01
THEN violation = TRUE (for sender)

IF abs((oldbalanceDest - amount) - newbalanceDest) > 0.01  
THEN violation = TRUE (for recipient)
```

**Window:** Single transaction

**Output:**
```json
{
  "rule_id": "BALANCE_MISMATCH",
  "violation_id": "uuid",
  "transaction_id": "step+nameOrig+nameDest",
  "amount": 1000.00,
  "expected_balance": 5000.00,
  "actual_balance": 4800.00,
  "discrepancy": 200.00,
  "account": "nameOrig or nameDest",
  "severity": "MEDIUM",
  "policy_reference": "Section 4: Balance Mismatch"
}
```

---

### Rule: ROUND_AMOUNT_PATTERN

**Description:** Flag 3+ round-dollar transactions ($X,000) within 30 days

**Inputs:**
- `nameOrig` (string) - Sender account
- `amount` (number) - Transaction amount
- `step` (int) - Time step

**Logic:**
```
DEFINE is_round(x) = (x % 1000) === 0

IF COUNT(transactions WHERE is_round(amount)) >= 3
AND MAX(step) - MIN(step) <= (720 * temporal_scale)
THEN violation = TRUE
```

**Window:** 30 days (720 steps * scale)

**Output:**
```json
{
  "rule_id": "ROUND_AMOUNT_PATTERN",
  "violation_id": "uuid",
  "account": "nameOrig",
  "transaction_count": 4,
  "amounts": [10000, 15000, 20000, 5000],
  "time_window": "30 days",
  "severity": "MEDIUM",
  "policy_reference": "Section 4: Round Amount Pattern"
}
```

---

## ⏱ Temporal Normalization Table

To ensure rules work across different datasets, the engine applies a scale factor to time-based windows.

| Dataset | Time Unit | `temporal_scale` | Rationale |
|---------|-----------|------------------|-----------|
| **PaySim** | 1 Hour | 1.0 | Base unit is hours |
| **IBM AML** | 1 Day | 24.0 | Converts days to hours |
| **Custom** | User-defined | X | Default 1.0 |

---

## 🗂 Violation Grouping (Alert Deduplication)

To avoid investigator fatigue, violations are rolled up into **Cases** in the UI.

| Level | Grouping Key | Display Logic |
|-------|--------------|---------------|
| **Account Case** | `nameOrig` | Group Structuring, Velocity, and Dormant rules |
| **Transaction Case** | `transaction_id` | Group Threshold, Mismatch, and Fraud rules |

**Grouping Logic:**
1. If a transaction violates multiple single-transaction rules (e.g., CTR_THRESHOLD + HIGH_VALUE_TRANSFER), show one row with multiple rule badges.
2. If an account triggers multiple windowed rules (e.g., SAR_VELOCITY + ROUND_AMOUNT), show one "Suspicious Account" case with a breakdown of triggers.

---

### Rule: FRAUD_INDICATOR

**Description:** Flag transactions to empty accounts (potential fraud)

**Inputs:**
- `type` (string) - Transaction type
- `nameDest` (string) - Recipient account
- `oldbalanceDest` (number) - Recipient balance before
- `newbalanceDest` (number) - Recipient balance after

**Logic:**
```
IF type IN ['CASH_OUT', 'TRANSFER']
AND oldbalanceDest == 0
AND newbalanceDest > 0
THEN violation = TRUE
```

**Window:** Single transaction

**Output:**
```json
{
  "rule_id": "FRAUD_INDICATOR",
  "violation_id": "uuid",
  "transaction_id": "step+nameOrig+nameDest",
  "type": "CASH_OUT",
  "recipient": "nameDest",
  "old_balance": 0,
  "new_balance": 5000.00,
  "severity": "HIGH",
  "policy_reference": "Section 5: Fraud Indicator"
}
```

---

### Rule: HIGH_VALUE_TRANSFER

**Description:** Flag wire/transfer transactions >$50,000

**Inputs:**
- `type` (string) - Transaction type
- `amount` (number) - Transaction amount

**Logic:**
```
IF type IN ['WIRE', 'TRANSFER']
AND amount > 50000
THEN violation = TRUE
```

**Window:** Single transaction

**Output:**
```json
{
  "rule_id": "HIGH_VALUE_TRANSFER",
  "violation_id": "uuid",
  "transaction_id": "step+nameOrig+nameDest",
  "type": "WIRE",
  "amount": 75000.00,
  "threshold": 50000,
  "severity": "HIGH",
  "policy_reference": "Section 5: High Value Transfer"
}
```

---

## Priority Model

When multiple rules flag the same transaction:

| Severity | Priority | Action |
|----------|----------|--------|
| CRITICAL | 1 | Auto-flag, require SAR review |
| HIGH | 2 | Flag for investigation |
| MEDIUM | 3 | Flag for monitoring |

**Duplicate handling:** Show all applicable rules, don't deduplicate.

---

## Implementation Pattern

```typescript
type Transaction = {
  step: number;
  type: string;
  amount: number;
  nameOrig: string;
  nameDest: string;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
};

type Violation = {
  rule_id: string;
  violation_id: string;
  transaction_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  policy_reference: string;
  evidence: Record<string, any>;
  explanation: string; // Generated from template
};

function evaluateRule(rule: Rule, tx: Transaction, context: RuleContext): Violation | null {
  if (rule.check(tx, context)) {
    return {
      rule_id: rule.id,
      violation_id: generateUUID(),
      transaction_id: tx.step + '_' + tx.nameOrig,
      severity: rule.severity,
      policy_reference: rule.policyReference,
      evidence: rule.extractEvidence(tx),
      explanation: generateExplanation(rule, tx),
    };
  }
  return null;
}
```
