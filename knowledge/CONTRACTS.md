# API Contracts: Yggdrasil

**Purpose:** Single source of truth for request/response shapes at every screen transition.
Both Person A (frontend) and Person B (backend) code against this file.

> If this file conflicts with API-Specification-Yggdrasil.md, THIS FILE wins.
> The full API spec has more detail; this file has the integration-critical shapes only.

---

## Screen 1 → Screen 2: No API call
Demo mode sets client-side session only.
```typescript
// Client side only
localStorage.setItem('demo_session', '00000000-0000-0000-0000-000000000001');
```

---

## Screen 2 → Screen 3: POST /api/audits
```typescript
// Request
{ name: string, policy_type: "aml" | "gdpr" | "soc2" }

// Response
{ 
  audit_id: string,       // UUID — pass to all subsequent calls
  policy_id: string,      // UUID of created/loaded policy
  rules: Rule[]           // Full rule objects for Screen 4
}
```

---

## Screen 3 → Screen 4: POST /api/data/upload
```typescript
// Request: multipart/form-data
file: File  // CSV

// Response
{
  upload_id: string,
  row_count: number,                          // e.g. 48234
  headers: string[],                          // ["base_amt", "nameOrig", ...]
  sample_rows: Record[],         // 5 rows
  detected_dataset: "IBM_AML" | "PAYSIM" | "GENERIC",
  suggested_mapping: Record,  // { "amount": "base_amt", ... }
  temporal_scale: number,                     // 24.0 or 1.0
  clarification_questions: ClarificationQuestion[]
}

interface ClarificationQuestion {
  question_id: string,
  question: string,
  options: string[]   // e.g. ["Yes, confirm", "No, it's hourly"]
}
```

---

## Screen 5 → Screen 6: POST /api/data/mapping/confirm + POST /api/scan/run
```typescript
// Step 1: confirm mapping
// Request
{
  upload_id: string,
  mapping_config: Record,   // { "amount": "base_amt", ... }
  temporal_scale: number,
  clarification_answers: Array  // empty array if skipped
}
// Response
{ mapping_id: string, ready_to_scan: true }

// Step 2: trigger scan immediately after
// Request
{
  audit_id: string,
  policy_id: string,
  upload_id: string,
  mapping_id: string
}
// Response
{ scan_id: string, status: "running" }
```

---

## Screen 6 polling: GET /api/scan/:id
```typescript
// Poll every 1000ms until status !== "running"
// Response
{
  id: string,
  status: "pending" | "running" | "completed" | "failed",
  violation_count: number,   // updates during scan
  compliance_score: number,  // 0-100, set on completion
  rules_processed: number,   // for progress display
  rules_total: number,
  created_at: string,
  completed_at: string | null
}
```

---

## Screen 7: GET /api/violations/cases
```typescript
// Query: ?scan_id=uuid
// Response
{
  cases: Array,
  total_cases: number,
  total_violations: number,
  compliance_score: number
}
```

---

## Screen 8: GET /api/violations/:id
```typescript
// Response
{
  id: string,
  scan_id: string,
  rule_id: string,
  rule_name: string,
  severity: "CRITICAL" | "HIGH" | "MEDIUM",
  account: string,
  amount: number,
  transaction_type: string,
  evidence: Record,     // full raw CSV row
  threshold: number,
  actual_value: number,
  policy_excerpt: string,            // exact text from policy doc
  policy_section: string,            // e.g. "Section 2 — Structuring Detection"
  explanation: string,               // filled template from explainability.md
  status: "pending" | "approved" | "false_positive",
  review_note: string | null,
  reviewed_at: string | null,
  rule_accuracy: {
    precision: number,
    recall: number,
    f1: number,
    validated_against: string
  }
}
```

## Screen 8 review: PATCH /api/violations/:id
```typescript
// Request
{
  status: "approved" | "false_positive",
  review_note?: string
}
// Response
{
  success: true,
  violation: { id, status, reviewed_at },
  updated_score: number   // recalculated compliance score
}
```

---

## Screen 8 remediation: POST /api/violations/:id/remediation
```typescript
// Request: empty body (violation context is fetched server-side)
{}

// Response (GDPR/SOC2 only — returns 400 for AML violations)
{
  summary: string,                   // e.g. "Encrypt PII fields at column level"
  steps: Array<{
    title: string,                   // e.g. "Step 1: Enable encryption extension"
    code: string,                    // actual code snippet
    language: "sql" | "typescript" | "python" | "bash" | "terraform" | "text"
  }>,
  estimated_effort: string,          // e.g. "30 minutes"
  risk_level: "low" | "medium" | "high",
  applicable_frameworks: string[]    // e.g. ["GDPR", "SOC2"]
}
```

---

## Shared Types
```typescript
interface Rule {
  rule_id: string          // "CTR_THRESHOLD"
  name: string             // "Currency Transaction Report Threshold"
  type: string             // "ctr_threshold"
  severity: "CRITICAL" | "HIGH" | "MEDIUM"
  threshold: number | null
  time_window: number | null
  conditions: {
    field: string
    operator: string
    value: any
  }
  policy_excerpt: string
  policy_section: string
  is_active: boolean
}

interface Violation {
  id: string
  scan_id: string
  rule_id: string
  rule_name: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM"
  account: string
  amount: number
  evidence: Record
  threshold: number
  actual_value: number
  policy_excerpt: string
  explanation: string
  status: "pending" | "approved" | "false_positive"
}
```
