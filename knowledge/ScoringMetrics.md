# Scoring Metrics

> Compliance score calculation for PolicyGuard AI

## Overview

The compliance score is a weighted metric (0-100%) that reflects how well the scanned data adheres to the defined policy rules. Non-compliant rows are weighted by their violation severity.

---

## Formula

```
compliance_score = 100 × (1 - weighted_violations / max_weighted_violations)
```

### Components

| Component | Description |
|-----------|-------------|
| `weighted_violations` | Sum of severity weights for all non-compliant rows |
| `max_weighted_violations` | Total rows × maximum severity weight (1.0) |

---

## Severity Weights

| Severity | Weight | Description |
|----------|--------|-------------|
| CRITICAL | 1.0 | Immediate regulatory action required (e.g., CTR threshold exceeded) |
| HIGH | 0.75 | Significant compliance risk requiring attention (e.g., structuring pattern) |
| MEDIUM | 0.5 | Moderate risk requiring monitoring (e.g., velocity limit) |

---

## Calculation Steps

### Step 1: Count Violations by Severity

```
violations_by_severity = {
  CRITICAL: count of CRITICAL violations,
  HIGH: count of HIGH violations,
  MEDIUM: count of MEDIUM violations
}
```

### Step 2: Calculate Weighted Violations

```
weighted_violations = 
  (violations.CRITICAL × 1.0) + 
  (violations.HIGH × 0.75) + 
  (violations.MEDIUM × 0.5)
```

### Step 3: Calculate Max Possible Weight

```
max_weighted_violations = total_rows_scanned × 1.0
```

### Step 4: Compute Score

```
raw_score = 100 × (1 - weighted_violations / max_weighted_violations)
compliance_score = ROUND(raw_score, 2)
```

---

## False Positive Exclusion

Violations marked as **false_positive** are excluded from the score calculation entirely.

```
active_violations = violations WHERE status != 'false_positive'
```

### Review Status Flow

| Status | Included in Score | Description |
|--------|-------------------|-------------|
| `pending` | Yes | Newly detected, not yet reviewed |
| `approved` | Yes | Confirmed violation |
| `false_positive` | **No** | Excluded from calculation |
| `disputed` | Yes | Under review, remains in score |

---

## Score Thresholds

| Score Range | Status | Color |
|-------------|--------|-------|
| 0-49% | Critical | 🔴 Red |
| 50-79% | Warning | 🟡 Yellow |
| 80-100% | Good | 🟢 Green |

---

## Examples

### Example 1: Clean Data

```
total_rows = 1000
violations = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 }

weighted_violations = 0
max_weighted_violations = 1000 × 1.0 = 1000
compliance_score = 100 × (1 - 0/1000) = 100
```

**Result:** 100% (Green)

---

### Example 2: Mixed Violations

```
total_rows = 1000
violations = { CRITICAL: 10, HIGH: 20, MEDIUM: 30 }

weighted_violations = (10 × 1.0) + (20 × 0.75) + (30 × 0.5)
                    = 10 + 15 + 15
                    = 40

max_weighted_violations = 1000 × 1.0 = 1000
compliance_score = 100 × (1 - 40/1000) = 100 × 0.96 = 96
```

**Result:** 96% (Green)

---

### Example 3: High Violations

```
total_rows = 500
violations = { CRITICAL: 50, HIGH: 100, MEDIUM: 50 }

weighted_violations = (50 × 1.0) + (100 × 0.75) + (50 × 0.5)
                    = 50 + 75 + 25
                    = 150

max_weighted_violations = 500 × 1.0 = 500
compliance_score = 100 × (1 - 150/500) = 100 × 0.7 = 70
```

**Result:** 70% (Yellow)

---

### Example 4: With False Positives

```
total_rows = 1000
violations = { CRITICAL: 20, HIGH: 10, MEDIUM: 10 }
false_positives = { CRITICAL: 5, HIGH: 5, MEDIUM: 5 }

active_violations = { CRITICAL: 15, HIGH: 5, MEDIUM: 5 }

weighted_violations = (15 × 1.0) + (5 × 0.75) + (5 × 0.5)
                    = 15 + 3.75 + 2.5
                    = 21.25

max_weighted_violations = 1000 × 1.0 = 1000
compliance_score = 100 × (1 - 21.25/1000) = 97.875 ≈ 97.88
```

**Result:** 97.88% (Green) — False positives excluded, score improved

---

## SQL Implementation

```sql
WITH violation_counts AS (
  SELECT 
    s.id AS scan_id,
    COUNT(*) AS total_rows,
    SUM(
      CASE v.severity
        WHEN 'CRITICAL' THEN 1.0
        WHEN 'HIGH' THEN 0.75
        WHEN 'MEDIUM' THEN 0.5
        ELSE 0
      END
    ) AS weighted_violations
  FROM scans s
  LEFT JOIN violations v ON v.scan_id = s.id
  WHERE v.status != 'false_positive'
    OR v.status IS NULL
  GROUP BY s.id
)
SELECT 
  scan_id,
  total_rows,
  weighted_violations,
  CASE 
    WHEN total_rows = 0 THEN 100
    ELSE ROUND(100 * (1 - weighted_violations / total_rows), 2)
  END AS compliance_score
FROM violation_counts;
```

---

## API Response

```json
{
  "scan_id": "uuid",
  "compliance_score": 85.5,
  "total_rows_scanned": 10000,
  "violation_summary": {
    "critical": 5,
    "high": 20,
    "medium": 40
  },
  "weighted_violations": 35,
  "score_status": "warning",
  "color": "yellow"
}
```

---

## Notes

- Score is calculated at scan completion
- Re-calculates when violation status changes (false positive approved)
- Score never goes below 0 or above 100
- For empty scans (0 rows), default score is 100%
