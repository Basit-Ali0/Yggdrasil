# Explainability Templates: PolicyGuard AI

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md).

**Related Docs:**
- [gist.md](../gist.md) - Project overview
- [enforcement-spec.md](./enforcement-spec.md) - Rule enforcement logic
- [policies/aml.md](./policies/aml.md) - AML policy rules

---

## Overview

Every violation MUST include a fixed-format explanation. This ensures:
- Consistent UX across all rules
- Judges can quickly understand violations
- Human reviewers can make informed decisions
- Audit trails are complete

---

## Template: CTR_THRESHOLD

```
Transaction {{transaction_id}} was flagged under CTR_THRESHOLD because:

- Amount: ${{amount}}
- Threshold: $10,000
- Transaction Type: {{type}}
- Account: {{nameOrig}}

Policy Reference: Section 1 - Currency Transaction Reporting
Severity: CRITICAL

This transaction exceeds the $10,000 CTR filing threshold and requires 
a Currency Transaction Report to be filed with FinCEN.
```

---

## Template: CTR_AGGREGATION

```
Account pair {{nameOrig}} → {{nameDest}} was flagged under CTR_AGGREGATION because:

- Aggregate Amount: ${{aggregate_amount}}
- Transaction Count: {{count}}
- Time Window: 24 hours
- Individual Amounts: {{amounts}}

Policy Reference: Section 1 - CTR Aggregation
Severity: CRITICAL

Multiple transactions to the same person within 24 hours exceeded the 
$10,000 aggregate CTR threshold.
```

---

## Template: STRUCTURING_PATTERN

```
Account {{nameOrig}} was flagged under STRUCTURING_PATTERN because:

- Transaction Count: {{count}}
- Individual Amounts: {{amounts}} (all between $8,000-$10,000)
- Total Amount: ${{total}}
- Time Window: {{time_window}}

Policy Reference: Section 2 - Structuring Detection
Severity: CRITICAL

This account conducted {{count}} transactions just under the $10,000 
CTR threshold within {{time_window}}, suggesting intentional structuring 
to avoid reporting requirements.
```

---

## Template: SUB_THRESHOLD_VELOCITY

```
Account {{nameOrig}} was flagged under SUB_THRESHOLD_VELOCITY because:

- Transaction Count: {{count}} (minimum: 5)
- Amount Range: $8,000 - $10,000 each
- Time Window: 24 hours

Policy Reference: Section 2 - Sub-Threshold Velocity
Severity: HIGH

This account exceeded the velocity threshold with {{count}} sub-threshold 
transactions, indicating potential structuring activity.
```

---

## Template: SAR_THRESHOLD

```
Transaction {{transaction_id}} was flagged under SAR_THRESHOLD because:

- Amount: ${{amount}}
- Threshold: $5,000
- Trigger: {{trigger_reason}}
- Additional Context: {{context}}

Policy Reference: Section 3 - Suspicious Activity Reporting
Severity: HIGH

This transaction meets the SAR filing criteria due to {{trigger_reason}}.
```

---

## Template: SAR_VELOCITY

```
Account {{nameOrig}} was flagged under SAR_VELOCITY because:

- Total Volume: ${{total_amount}}
- Transaction Count: {{count}}
- Time Window: 24 hours
- Threshold: $25,000

Policy Reference: Section 3 - SAR Velocity
Severity: HIGH

This account exceeded the $25,000 daily transaction volume threshold.
```

---

## Template: DORMANT_ACCOUNT_REACTIVATION

```
Account {{nameOrig}} was flagged under DORMANT_ACCOUNT_REACTIVATION because:

- Transaction Amount: ${{amount}}
- Days Dormant: {{days_dormant}}
- Days Since Reactivation: {{days_since}}
- Dormancy Threshold: 90 days
- Reactivation Threshold: $5,000

Policy Reference: Section 4 - Account Behavior Monitoring
Severity: MEDIUM

This account had been inactive for {{days_dormant}} days before 
conducting a transaction exceeding $5,000.
```

---

## Template: BALANCE_MISMATCH

```
Transaction {{transaction_id}} was flagged under BALANCE_MISMATCH because:

- Transaction Amount: ${{amount}}
- Expected Balance Change: ${{expected_change}}
- Actual Balance Change: ${{actual_change}}
- Discrepancy: ${{discrepancy}}
- Account: {{account}}

Policy Reference: Section 4 - Balance Verification
Severity: MEDIUM

The balance change does not match the transaction amount, indicating 
a potential data entry error or system issue.
```

---

## Template: ROUND_AMOUNT_PATTERN

```
Account {{nameOrig}} was flagged under ROUND_AMOUNT_PATTERN because:

- Transaction Count: {{count}} (minimum: 3)
- Amounts: {{amounts}}
- Time Window: {{time_window}}

Policy Reference: Section 4 - Transaction Pattern Monitoring
Severity: MEDIUM

This account conducted {{count}} round-dollar transactions within 
{{time_window}}, which may indicate intentional amount selection 
to avoid detection.
```

---

## Template: FRAUD_INDICATOR

```
Transaction {{transaction_id}} was flagged under FRAUD_INDICATOR because:

- Transaction Type: {{type}}
- Recipient: {{nameDest}}
- Recipient Old Balance: ${{old_balance_dest}}
- Recipient New Balance: ${{new_balance_dest}}

Policy Reference: Section 5 - Fraud Detection
Severity: HIGH

This transaction was sent to an account with zero prior balance, 
a common pattern in fraud schemes.
```

---

## Template: HIGH_VALUE_TRANSFER

```
Transaction {{transaction_id}} was flagged under HIGH_VALUE_TRANSFER because:

- Transaction Type: {{type}}
- Amount: ${{amount}}
- Threshold: $50,000

Policy Reference: Section 5 - High Value Transfer Monitoring
Severity: HIGH

This wire/transfer exceeds the $50,000 monitoring threshold and 
requires enhanced review.
```

---

## Template: HUMAN_OVERRIDE

```
Violation {{violation_id}} was reviewed and {{decision}} by {{reviewer}}:

- Original Rule: {{rule_id}}
- Original Severity: {{original_severity}}
- Review Note: {{review_note}}
- Decision Date: {{date}}

{{#if override}}
OVERRIDE REASON: {{override_reason}}
{{/if}}
```

---

## UI Display Format

### Violation Card (Frontend)

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ CRITICAL: CTR_THRESHOLD                              │
├─────────────────────────────────────────────────────────┤
│ Transaction ID: TX-12345                                │
│ Amount: $12,500.00 (Threshold: $10,000)                 │
│ Account: ACC-5678 → ACC-9012                            │
│                                                         │
│ Policy Ref: Section 1 - Currency Transaction Reporting  │
│                                                         │
│ [View Details] [Approve ✓] [Override ✗]                │
└─────────────────────────────────────────────────────────┘
```

### Explanation Modal

```
Why was this flagged?

Transaction TX-12345 was flagged under CTR_THRESHOLD because:

- Amount: $12,500.00
- Threshold: $10,000
- Transaction Type: WIRE
- Account: ACC-5678

Policy Reference: Section 1 - Currency Transaction Reporting
Severity: CRITICAL

This transaction exceeds the $10,000 CTR filing threshold...
```

---

## Evidence Extraction

Each rule MUST extract and store:

| Field | Required | Description |
|-------|----------|-------------|
| `rule_id` | ✅ | Rule identifier |
| `transaction_id` | ✅ | Unique transaction reference |
| `amount` | ✅ | Transaction amount |
| `threshold` | ✅ | Rule threshold |
| `timestamp` | ✅ | When violation detected |
| `account` | ✅ | Affected account(s) |
| `evidence_data` | ✅ | Rule-specific evidence |
| `policy_excerpt` | ✅ | Exact policy text |
| `severity` | ✅ | CRITICAL/HIGH/MEDIUM |
| `explanation` | ✅ | Filled template |

---

## Audit Trail

Every action is logged:

```json
{
  "action": "REVIEW_VIOLATION",
  "violation_id": "uuid",
  "user_id": "user-uuid",
  "decision": "APPROVED|OVERRIDE|ESCALATE",
  "review_note": "...",
  "timestamp": "ISO-8601",
  "previous_state": "PENDING",
  "new_state": "APPROVED|REJECTED"
}
```
