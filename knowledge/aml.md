# AML Policy Compliance Pack

## Policy Information

- **Policy Name:** Anti-Money Laundering (AML) Compliance Policy
- **Version:** 1.0
- **Effective Date:** 2024-01-01
- **Jurisdiction:** United States (Bank Secrecy Act / FinCEN)
- **Rule Count:** 10

---

## Section 1: Currency Transaction Reporting (CTR)

### Rule: CTR_THRESHOLD

The Institution shall file a Currency Transaction Report (CTR) for each transaction in currency (domestic or foreign) of more than **$10,000** conducted by or on behalf of the same person.

**Conditions:**
- Transaction type includes CASH_IN, CASH_OUT, DEPOSIT, or WIRE
- Transaction amount > $10,000

**Severity:** CRITICAL

---

### Rule: CTR_AGGREGATION

Multiple transactions by or on behalf of the same person during any one business day shall be aggregated for purposes of determining whether the $10,000 threshold is exceeded.

**Conditions:**
- Same account (nameOrig or nameDest) has multiple transactions within same day (step)
- Aggregate amount > $10,000

**Severity:** CRITICAL

---

## Section 2: Structuring Detection

### Rule: STRUCTURING_PATTERN

No person shall structure, or assist in structuring, any transaction for the purpose of evading the CTR reporting requirement. Any transaction or pattern of transactions designed to evade CTR requirements, including multiple transactions totaling $10,000 or more within a single business day that appear structured to avoid the reporting threshold, shall be reported.

**Conditions:**
- 3 or more transactions within 24 hours (step)
- Individual amounts between $8,000 and $10,000
- OR aggregate within 24 hours > $10,000

**Severity:** CRITICAL

---

### Rule: SUB_THRESHOLD_VELOCITY

Flag any customer account with 5 or more transactions in a rolling 24-hour period where individual transaction amounts are between $8,000 and $10,000.

**Conditions:**
- Transaction count >= 5 within 24-hour window
- All amounts >= $8,000 and < $10,000

**Severity:** HIGH

---

## Section 3: Suspicious Activity Reporting

### Rule: SAR_THRESHOLD

The Institution shall file a Suspicious Activity Report (SAR) when detecting any known or suspected violation of federal law, or any transaction totaling **$5,000 or more** where it knows, suspects, or has reason to suspect that the transaction involves funds derived from illegal activity.

**Conditions:**
- Transaction amount >= $5,000
- AND suspicious pattern detected (structuring, unusual behavior)

**Severity:** HIGH

---

### Rule: SAR_VELOCITY

Flag any individual account with transaction volume exceeding $25,000 within any 24-hour period.

**Conditions:**
- Sum of all transactions (amount) > $25,000
- Within same account
- Within 24-hour window (24 steps)

**Severity:** HIGH

---

## Section 4: Account Behavior Monitoring

### Rule: DORMANT_ACCOUNT_REACTIVATION

Flag any account that has been inactive for 90 or more days (no transactions exceeding $100) when that account conducts a transaction exceeding $5,000 within the first 30 days of reactivation.

**Conditions:**
- Account had no transactions for 90+ steps
- Current transaction amount > $5,000
- Transaction within 30 steps of reactivation

**Severity:** MEDIUM

---

### Rule: BALANCE_MISMATCH

Flag any transaction where the balance change does not match the transaction amount. The new balance should equal old balance plus/minus transaction amount.

**Conditions:**
- newbalanceOrig != oldbalanceOrg + amount (for sender)
- OR newbalanceDest != oldbalanceDest - amount (for receiver)

**Severity:** MEDIUM

---

### Rule: ROUND_AMOUNT_PATTERN

Flag any series of 3 or more transactions occurring within 30 days where transaction amounts are within $500 of round thousand-dollar amounts ($5,000, $10,000, $15,000, $20,000).

**Conditions:**
- 3+ transactions within 30 steps
- Each amount is within $500 of n * $1000
- Amounts: $4,500-$5,500, $9,500-$10,500, etc.

**Severity:** MEDIUM

---

## Section 5: Transaction Type Rules

### Rule: FRAUD_INDICATOR

Transactions involving CASH_OUT or TRANSFER types where the recipient's balance before transaction is zero but after transaction shows large balance may indicate fraudulent activity.

**Conditions:**
- Transaction type in [CASH_OUT, TRANSFER]
- oldbalanceDest == 0
- newbalanceDest > 0

**Severity:** HIGH

---

### Rule: HIGH_VALUE_TRANSFER

Flag any WIRE or TRANSFER transaction exceeding $50,000.

**Conditions:**
- Transaction type in [WIRE, TRANSFER]
- Amount > $50,000

**Severity:** HIGH

---

## Implementation Notes

### Data Field Mapping

| Dataset Column | Description |
|----------------|-------------|
| step | Time unit (1 step = 1 hour) |
| type | Transaction type |
| amount | Transaction amount |
| nameOrig | Originator account |
| nameDest | Beneficiary account |
| oldbalanceOrg | Sender balance before |
| newbalanceOrig | Sender balance after |
| oldbalanceDest | Recipient balance before |
| newbalanceDest | Recipient balance after |
| isFraud | Fraud label (for validation) |

### Time Window Conversions

- 24 hours = 24 steps
- 7 days = 168 steps
- 30 days = 720 steps
- 90 days = 2160 steps

### Severity Levels

- **CRITICAL**: Requires immediate SAR filing
- **HIGH**: Requires investigation within 30 days
- **MEDIUM**: Requires enhanced monitoring

---

## Ground Truth Validation

This policy pack is designed for use with:

1. **IBM AML Dataset**: Validate against `IsLaundering` column
2. **PaySim Dataset**: Validate against `isFraud` column

Expected detection targets:
- Structuring patterns (multiple sub-$10K transactions)
- High-velocity accounts
- Dormant account reactivation
- Balance anomalies

---

**End of AML Compliance Policy**
