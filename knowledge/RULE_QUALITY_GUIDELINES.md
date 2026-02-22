# Rule Quality Guidelines — Reducing False Positives

## Executive Summary

Analysis of 50,000 transactions revealed **key insights** for reducing false positives while maintaining good detection rates:

| Metric | Original Rules | Optimized Rules | Improvement |
|--------|---------------|-----------------|-------------|
| Recall | 91% | 91% | Maintained |
| Precision | 0.24% | 1.7% | **7x better** |
| False Positives | 37,530 | 5,113 | **86% reduction** |

The key difference: **Multi-signal rules** instead of **single-signal rules**.

---

## Key Insights

### 1. Single-Signal Rules Are the Problem

Rules that trigger on ONE condition have high false positives:

```
❌ BAD: Flag if amount >= $10,000
   → Flags 26,598 transactions, only 90 are fraud (0.3% precision)

✅ GOOD: Flag if (CASH_OUT or TRANSFER) AND account_emptied AND dest_was_empty
   → Flags 1,549 transactions, 65 are fraud (4.2% precision)
```

### 2. Transaction Type Filtering Is Critical

Fraud patterns are type-specific. In our dataset:
- **100% of fraud** occurred in `CASH_OUT` and `TRANSFER` types
- **0% of fraud** in `PAYMENT`, `DEBIT`, `CASH_IN`, `DEPOSIT`

Rule: **Always include transaction type as a required condition.**

### 3. Account State Changes Are Strong Signals

| Signal | Fraud Rate in Signal | False Positive Rate |
|--------|---------------------|---------------------|
| Origin account emptied | 1.4% | 98.6% |
| Destination was empty | 0.28% | 99.7% |
| Both conditions combined | **4.2%** | 95.8% |

**Combining signals compounds precision.**

### 4. Thresholds Alone Are Insufficient

Amount thresholds without context:
- `amount >= $10,000`: 0.3% precision
- `amount >= $50,000`: 0.5% precision

Amount thresholds WITH context:
- `CASH_OUT + account_emptied + amount >= $10,000`: 1.8% precision
- `TRANSFER + dest_empty + amount >= $10,000`: 3.4% precision

---

## Generalizable Patterns

### Pattern 1: Multi-Condition Rules

Every rule should require **at least 2-3 conditions**:

```typescript
interface QualityRule {
  // REQUIRED: At least 2 conditions
  conditions: [
    { type: 'transaction_type', values: ['CASH_OUT', 'TRANSFER'] },
    { type: 'account_state', check: 'emptied' },
    { type: 'amount', operator: '>=', value: 10000 },
  ];
}
```

### Pattern 2: Transaction Type Specificity

Rules should specify which transaction types they apply to:

```
❌ "Flag transactions over $10,000"
✅ "Flag CASH_OUT and TRANSFER transactions over $10,000 where the 
   origin account balance drops to zero"
```

### Pattern 3: Account Behavior Context

Rules should consider what's happening to the accounts:

- Origin account behavior: Did balance drop to zero? Unusual for this account?
- Destination account behavior: Was it newly created? Was it empty before?
- Velocity context: Is this a burst of activity?

### Pattern 4: Combine Signals for Higher Confidence

Instead of multiple independent rules, use **combined signal rules**:

```
INSTEAD OF:
  Rule A: amount >= $10,000
  Rule B: account_emptied

USE:
  Rule C: amount >= $10,000 AND account_emptied AND (CASH_OUT or TRANSFER)
```

---

## LLM Prompt Engineering

### Current Problem

The LLM extracting rules from PDFs tends to create simple threshold rules:

```
"Transactions exceeding $10,000 must be reported"
→ Creates: { amount >= 10000 }  // Too broad!
```

### Solution: Enhanced System Prompt

Add this guidance to the rule extraction prompt:

```
RULE EXTRACTION GUIDELINES:

1. ALWAYS specify transaction types when extracting rules
   - If the policy mentions "cash transactions", specify CASH_OUT, CASH_IN
   - If the policy mentions "transfers", specify TRANSFER, WIRE
   
2. PREFER multi-condition rules over single-condition rules
   - Combine amount thresholds with account behavior signals
   - Look for patterns like "when X happens AND Y occurs"
   
3. ACCOUNT BEHAVIOR SIGNALS to look for:
   - "account emptied" / "balance reduced to zero"
   - "newly created account" / "no prior activity"
   - "rapid movement" / "velocity" / "frequency"
   
4. AVOID overly broad rules
   - "all transactions over $X" is too broad
   - Add context: "wire transfers over $X to new accounts"

5. RULE TEMPLATE:
   Each extracted rule should include:
   - transaction_types: [specific types]
   - primary_condition: [amount threshold, behavior]
   - secondary_conditions: [account state, velocity, etc.]
   - minimum_conditions: 2 (require at least 2 signals)
```

---

## Post-Processing Layer

After LLM extracts rules, apply quality filters:

```typescript
function validateRuleQuality(rule: Rule): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check 1: Transaction types specified?
  if (!rule.transaction_types || rule.transaction_types.length === 0) {
    warnings.push('No transaction types specified - may cause high FP');
  }
  
  // Check 2: Multiple conditions?
  const conditionCount = countConditions(rule);
  if (conditionCount < 2) {
    warnings.push('Single-condition rules have high false positive rates');
  }
  
  // Check 3: Threshold-only rule?
  if (isThresholdOnly(rule)) {
    warnings.push('Threshold-only rules should include account behavior context');
  }
  
  // Check 4: Reasonable threshold?
  if (rule.threshold && rule.threshold < 1000) {
    warnings.push('Very low threshold may cause excessive false positives');
  }
  
  return {
    valid: warnings.length < 2, // Require < 2 warnings
    warnings
  };
}
```

---

## Recommended Rule Architecture

### Tier 1: High-Specificity Rules (Low FP, High Confidence)

```typescript
{
  rule_id: 'HIGH_RISK_FRAUD_PATTERN',
  name: 'High-Risk Fraud Pattern',
  severity: 'CRITICAL',
  conditions: {
    AND: [
      { transaction_type: ['CASH_OUT', 'TRANSFER'] },
      { origin_account_emptied: true },
      { destination_was_empty: true },
    ]
  }
}
```

### Tier 2: Medium-Specificity Rules (Moderate FP)

```typescript
{
  rule_id: 'SUSPICIOUS_CASH_OUT',
  name: 'Suspicious Cash Out',
  severity: 'HIGH',
  conditions: {
    AND: [
      { transaction_type: ['CASH_OUT'] },
      { origin_account_emptied: true },
      { amount: { gte: 10000 } }
    ]
  }
}
```

### Tier 3: Broad Rules (Higher FP, Use Sparingly)

```typescript
{
  rule_id: 'CTR_THRESHOLD',
  name: 'CTR Threshold',
  severity: 'MEDIUM',  // Lower severity for broad rules
  conditions: {
    AND: [
      { transaction_type: ['CASH_OUT', 'TRANSFER'] },
      { amount: { gte: 10000 } }
    ]
  }
}
```

---

## Implementation Checklist

### For LLM Rule Extraction

- [ ] Update system prompt with multi-condition guidance
- [ ] Add transaction type inference logic
- [ ] Include account behavior signal detection
- [ ] Add minimum conditions requirement (>= 2)

### For Rule Engine

- [ ] Implement rule quality validation
- [ ] Add tier-based severity (higher specificity = higher severity)
- [ ] Support AND/OR condition combinations
- [ ] Add account behavior context checks

### For User Experience

- [ ] Group violations by confidence level
- [ ] Allow users to dismiss false positives
- [ ] Learn from user feedback to adjust rule weights
- [ ] Show "high confidence" vs "low confidence" violations separately

---

## Metrics to Track

### Per-Rule Metrics

```typescript
interface RuleMetrics {
  rule_id: string;
  total_flagged: number;
  user_approved: number;
  user_dismissed: number;  // False positives
  precision_estimate: number; // approved / total_flagged
}
```

### System-Wide Metrics

```typescript
interface SystemMetrics {
  overall_precision: number;
  overall_recall: number;
  false_positive_rate: number;
  alert_fatigue_score: number; // % of alerts users dismiss
}
```

---

## Conclusion

The key to reducing false positives is **specificity through multi-signal rules**:

1. **Transaction type filtering** — Only apply rules to relevant transaction types
2. **Account behavior context** — Look for state changes, not just amounts
3. **Combined conditions** — Require 2+ signals before flagging
4. **Tier-based severity** — More specific rules get higher severity

By applying these patterns systematically, the LLM will generate rules that are **precision-conscious** rather than **recall-obsessed**, leading to a better user experience with fewer false alarms.
