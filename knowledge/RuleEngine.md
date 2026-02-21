# Rule Executor Architecture

**Project:** PolicyGuard AI  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../../gist.md](../../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [gist.md](../../gist.md) - Project overview
- [schema.md](../schema.md) - Database schema
- [enforcement-spec.md](../enforcement-spec.md) - Rule specifications
- [explainability.md](../explainability.md) - Explanation templates

---

## Concept

The RuleExecutor is an abstraction that separates **what rules do** from **how rules run**.

This design ensures:
- Deterministic enforcement (LLM extracts, code executes)
- Testable business logic
- Future-proof execution backend

---

## Interfaces

### ExecutionBackend

```typescript
interface ExecutionBackend {
  name: string;
  execute(rule: Rule, dataset: Dataset, config: ExecutionConfig): Violation[];
}

interface ExecutionConfig {
  temporalScale: number; // 1.0 or 24.0
  sampleLimit: number;   // e.g., 50000 rows
  columnMapping: Record<string, string>; // { 'amount': 'txn_amt' }
}
```

The backend implements actual rule checking logic. Current implementation: InMemoryBackend with mandatory sampling.

---

## ⏱ Temporal Normalization

The `TemporalNormalizer` ensures that "24-hour" rules work whether the data is in hours (PaySim) or days (IBM).

```typescript
function normalizeTime(step: number, scale: number): number {
  return step * scale;
}
```

All rules in the `InMemoryBackend` must use `normalizeTime(tx.step, config.temporalScale)` when calculating window bounds.

---

## ⚡️ Performance & Sampling

To ensure the demo never hangs or crashes:
1. **Papa Parse `step` Limit:** The CSV parser will stop after `config.sampleLimit` rows.
2. **Deterministic Processing:** Windowed aggregations (GROUP BY) use a single-pass hash map to maintain O(N) complexity.

---

## 🧩 Schema Mapping Layer

Before execution, the `RuleExecutor` transforms the raw dataset records using the approved `columnMapping`.

```typescript
function getMappedValue(record: any, ruleField: string, mapping: Record<string, string>) {
  const csvField = mapping[ruleField] || ruleField;
  return record[csvField];
}
```

---

### Rule

```typescript
interface Rule {
  id: string;           // 'CTR_THRESHOLD'
  name: string;        // 'Currency Transaction Report Threshold'
  type: string;        // 'ctr_threshold'
  description?: string;
  threshold?: number;   // 10000
  timeWindow?: number;  // null for single-transaction
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  conditions: RuleCondition[];
  policyExcerpt: string;
  policySection?: string;
}

interface RuleCondition {
  field: string;       // 'amount'
  operator: string;    // '>=', '<', 'IN', 'BETWEEN'
  value: any;         // 10000, [8000, 10000]
}
```

---

### Dataset

```typescript
interface Dataset {
  records: Record[];
  schema: DatasetSchema;
  source: 'csv' | 'json' | 'airtable';
  recordCount: number;
}

interface DatasetSchema {
  columns: Column[];
}

interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
}
```

---

### Violation

```typescript
interface Violation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  recordId?: string;
  account?: string;
  amount?: number;
  transactionType?: string;
  evidence: Record;
  threshold?: number;
  actualValue?: number;
  policyExcerpt?: string;
  policySection?: string;
  explanation: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

---

## RuleExecutor Class

```typescript
class RuleExecutor {
  constructor(private backend: ExecutionBackend) {}
  
  executeAll(rules: Rule[], dataset: Dataset): Violation[] {
    const violations: Violation[] = [];
    
    for (const rule of rules) {
      if (!rule.id || !dataset.records.length) continue;
      
      const ruleViolations = this.backend.execute(rule, dataset);
      violations.push(...ruleViolations);
    }
    
    return violations;
  }
}
```

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      RuleExecutor                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  rules: Rule[]    ┌──────────────────────────────────┐     │
│  ────────────────►│       ExecutionBackend          │     │
│                   │                                  │     │
│  dataset: Dataset │   execute(rule, dataset)        │     │
│  ────────────────►│          ↓                      │     │
│                   │   ┌────────────────────────┐    │     │
│                   │   │   For each record:    │    │     │
│                   │   │   Check conditions    │    │     │
│                   │   │   Generate violation  │    │     │
│                   │   └───────────┬──────────┘    │     │
│                   │               ↓               │     │
│                   │   violations: Violation[]    │     │
│                   └──────────────────────────────────┘     │
│                            ↓                                │
│                   ┌──────────────────────────────────┐      │
│                   │     Violation[] + Score         │      │
│                   │     + Ground Truth Metrics      │      │
│                   └──────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Deterministic Enforcement

**Critical Design Decision:**

| Stage | Method | Purpose |
|-------|--------|---------|
| Rule Extraction | LLM (Gemini) | Convert PDF → Structured rules |
| Rule Enforcement | Pure Code | No LLM in execution path |
| Explanation | Templates | Fixed format, no AI hallucination |

This ensures:
- Same input → Same output (deterministic)
- Audit-ready decisions
- No AI hallucinations in compliance

---

## Ground Truth Validation

The executor also computes accuracy metrics:

```typescript
interface ValidationMetrics {
  precision: number;      // TP / (TP + FP)
  recall: number;        // TP / (TP + FN)
  f1: number;           // 2 * P * R / (P + R)
  fpr: number;          // FP / (FP + TN)
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  summary: string;      // "Detected 86% of violations with 12% false positives"
}

function validate(violations: Violation[], groundTruth: Set<string>): ValidationMetrics {
  const detectedPositive = new Set(violations.map(v => v.recordId));
  
  // Compute TP, FP, FN, TN...
  // Return metrics
}
```

---

## Why This Abstraction Matters

| Concern | Solution |
|---------|----------|
| Testability | Mock backend for unit tests |
| Performance | Swap to faster backend later |
| Debugging | Single execution path |
| Compliance | Audit every rule execution |
| Future | Add new backends without rewriting rules |

---

## Implementation

See [InMemoryBackend.md](./InMemoryBackend.md) for the default implementation.
