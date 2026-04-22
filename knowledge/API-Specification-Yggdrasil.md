# API Specification: Yggdrasil

**Version:** v1
**Status:** Ready for Implementation

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [Integrations.md](./Integrations.md) - Data source integrations
- [WorkSplit-Yggdrasil.md](./WorkSplit-Yggdrasil.md) - Implementation timeline

---

## Base URL

```
http://localhost:3000/api
```

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /policies/ingest | Upload PDF and extract rules |
| GET | /policies/:id | Get policy with extracted rules |
| PUT | /policies/:id/rules | Update rules for a policy |
| POST | /connections/test | Test database connection |
| POST | /connections | Save connection config |
| GET | /connections | List saved connections |
| GET | /schema | Get database schema |
| POST | /scan/run | Run compliance scan (sync; validates mapping + executable rules) |
| POST | /api/scan/rescan | Same request/response as `/api/scan/run` (alias for rescan UX) |
| POST | /api/policies/generate-rules | Extract rules from pasted policy text (Gemini) |
| POST | /api/policies/:id/rules/add-pdf | Upload PDF; append extracted rules to an existing policy (skip duplicate `rule_id`) |
| POST | /api/data/mapping/readiness | Pre-scan mapping evaluation vs active executable rules |
| GET | /scan/history | Get scan history |
| GET | /scan/:id | Get scan details |
| GET | /violations | List violations |
| GET | /violations/:id | Get violation details |
| PATCH | /violations/:id | Update violation (review) |
| GET | /compliance/score | Get compliance score |
| GET | /export | Export compliance report |
| POST | /api/audits | Create a new audit |
| POST | /api/policies/prebuilt | Load a prebuilt policy (aml/gdpr/soc2) |
| POST | /api/data/mapping/confirm | Confirm column mapping before scan |
| PATCH | /api/policies/:id/rules | Toggle `is_active` on a rule (`rule_id`, `is_active`) |
| GET  | /api/violations/cases | Get violations grouped by account |
| POST | /api/validate | Compute accuracy against ground truth labels |

---

## Detailed API Endpoints

### 1. Policy Endpoints

#### POST /policies/ingest

Upload PDF policy document and extract rules.

**Request:**

```http
POST /api/policies/ingest
Content-Type: multipart/form-data

file: <PDF file>
```

**Response (201):**

```json
{
  "policy": {
    "id": "uuid",
    "name": "GDPR Policy 2024",
    "rules": [
      {
        "rule_id": "rule_001",
        "type": "encryption",
        "description": "Email addresses must be encrypted at rest",
        "severity": "high",
        "conditions": {
          "field": "email",
          "operator": "exists",
          "value": null
        },
        "policy_excerpt": "All personal data including email addresses must be encrypted at rest..."
      }
    ],
    "created_at": "2026-02-21T10:00:00Z"
  },
  "rule_validation": [
    {
      "rule_id": "RULE_001",
      "valid": true,
      "issues": []
    },
    {
      "rule_id": "RULE_002",
      "valid": false,
      "issues": [
        { "category": "unsupported_operator", "message": "operator is not supported: fuzzy_match", "path": "conditions.operator" }
      ]
    }
  ]
}
```

`rule_validation` mirrors engine `validateRuleForExecution`. Invalid rules are still inserted with `is_active: false` when columns `validation_status` / `validation_issues` exist (see migration `2026-04-03-rules-validation-metadata.sql`).

#### GET /policies/:id

Get policy details with extracted rules.

**Response (200):**

```json
{
  "id": "uuid",
  "name": "GDPR Policy 2024",
  "pdf_url": "/uploads/policy.pdf",
  "rules": [...],
  "created_at": "2026-02-21T10:00:00Z",
  "updated_at": "2026-02-21T10:00:00Z"
}
```

#### PUT /policies/:id/rules

Update rules for a policy (manual editing).

**Request:**

```json
{
  "rules": [
    {
      "rule_id": "rule_001",
      "type": "encryption",
      "description": "Updated description",
      "severity": "high",
      "conditions": {...}
    }
  ]
}
```

**Response (200):**

```json
{
  "success": true,
  "policy": {...}
}
```

---

### 2. Connection Endpoints

#### POST /connections/test

Test database connection without saving.

**Request:**

```json
{
  "type": "supabase",
  "config": {
    "url": "https://xxx.supabase.co",
    "apiKey": "eyJ..."
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Connection successful",
  "schema": {
    "tables": [
      {
        "name": "users",
        "columns": [
          {"name": "id", "type": "uuid"},
          {"name": "email", "type": "text"},
          {"name": "created_at", "type": "timestamp"}
        ]
      }
    ]
  }
}
```

#### POST /connections

Save connection configuration.

**Request:**

```json
{
  "type": "supabase",
  "name": "Production DB",
  "config": {
    "url": "https://xxx.supabase.co",
    "apiKey": "eyJ..."
  }
}
```

**Response (201):**

```json
{
  "connection": {
    "id": "uuid",
    "type": "supabase",
    "name": "Production DB",
    "created_at": "2026-02-21T10:00:00Z"
  }
}
```

#### GET /connections

List all saved connections.

**Response (200):**

```json
{
  "connections": [
    {
      "id": "uuid",
      "type": "supabase",
      "name": "Production DB",
      "created_at": "2026-02-21T10:00:00Z"
    }
  ]
}
```

---

### 3. Schema Endpoint

#### GET /schema

Get database schema for current connection.

**Response (200):**

```json
{
  "connection_id": "uuid",
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "nullable": false,
          "sample_values": ["uuid-1", "uuid-2"]
        },
        {
          "name": "email",
          "type": "text",
          "nullable": true,
          "sample_values": ["user@example.com"]
        }
      ]
    }
  ]
}
```

---

### 4. Scan Endpoints

#### POST /scan/run

Run a compliance scan (current app: **synchronous**; returns when finished).

**Request:**

```json
{
  "audit_id": "uuid",
  "policy_id": "uuid",
  "upload_id": "uuid",
  "mapping_id": "uuid",
  "audit_name": "optional string"
}
```

**Response (200):**

```json
{
  "scan_id": "uuid",
  "status": "completed"
}
```

**Errors:**

| Status | `error` | Meaning |
|--------|---------|---------|
| 400 | `VALIDATION_ERROR` | Body failed schema validation |
| 400 | `MAPPING_INCOMPLETE` | Required mappings missing or CSV columns invalid (`details.missing_required`, `details.invalid_columns`) |
| 404 | `NOT_FOUND` | Mapping, upload, no active rules, or no **executable** rules after validation |
| 401 | `UNAUTHORIZED` | Auth required |

**Note:** Only rules with `is_active: true` **and** passing `validateRuleForExecution` are executed. Logs emit JSON lines with `component: "scan/run"` / `"RuleExecutor"` for backend choice and completion.

#### POST /api/scan/rescan

**Same handler as POST /api/scan/run** (identical JSON body and responses). Provided so clients that distinguish “rescan” from “first scan” can call a dedicated path. Server-side **violation diff** (new vs resolved vs unchanged vs prior scan) is not part of this handler yet.

#### GET /scan/history

Get scan history with deltas.

**Response (200):**

```json
{
  "scans": [
    {
      "id": "uuid",
      "policy_id": "uuid",
      "score": 85.5,
      "violation_count": 5,
      "new_violations": 2,
      "resolved_violations": 1,
      "status": "completed",
      "created_at": "2026-02-21T10:00:00Z"
    }
  ]
}
```

#### GET /scan/:id

Get specific scan details.

**Response (200):**

```json
{
  "id": "uuid",
  "policy_id": "uuid",
  "connection_id": "uuid",
  "score": 85.5,
  "violation_count": 5,
  "high_severity": 2,
  "medium_severity": 2,
  "low_severity": 1,
  "status": "completed",
  "started_at": "2026-02-21T10:00:00Z",
  "completed_at": "2026-02-21T10:00:05Z"
}
```

---

### 5. Violation Endpoints

#### GET /violations

List violations with filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| scan_id | uuid | Filter by scan |
| severity | string | Filter: high, medium, low |
| status | string | Filter: open, resolved, false_positive |
| table | string | Filter by table name |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

**Response (200):**

```json
{
  "violations": [
    {
      "id": "uuid",
      "scan_id": "uuid",
      "rule_id": "rule_001",
      "table": "users",
      "column": "email",
      "evidence": ["user@example.com"],
      "severity": "high",
      "policy_excerpt": "All personal data including email...",
      "explanation": "Column 'email' contains unencrypted personal data",
      "status": "open",
      "created_at": "2026-02-21T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

#### GET /violations/:id

Get violation details.

**Response (200):**

```json
{
  "id": "uuid",
  "scan_id": "uuid",
  "rule_id": "rule_001",
  "type": "encryption",
  "rule_description": "Email addresses must be encrypted at rest",
  "table": "users",
  "column": "email",
  "evidence": ["user@example.com"],
  "severity": "high",
  "policy_excerpt": "All personal data including email addresses must be encrypted at rest...",
  "explanation": "Column 'email' contains unencrypted personal data which violates the encryption requirement",
  "status": "open",
  "reviewed_by": null,
  "review_note": null,
  "created_at": "2026-02-21T10:00:00Z",
  "resolved_at": null,
  "rule_accuracy": {
    "precision": 0.92,
    "recall": 0.95,
    "f1": 0.93,
    "validated_against": "IBM_AML_IsLaundering"
  }
}
```

#### PATCH /violations/:id

Update violation (review action).

**Request:**

```json
{
  "status": "false_positive",
  "review_note": "This is test data, not production"
}
```

**Response (200):**

```json
{
  "success": true,
  "violation": {
    "id": "uuid",
    "status": "false_positive",
    "reviewed_by": "user@example.com",
    "review_note": "This is test data, not production",
    "resolved_at": "2026-02-21T10:05:00Z"
  }
}
```

---

### 6. Compliance Score Endpoint

#### GET /compliance/score

Get current compliance score.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| scan_id | uuid | Specific scan (optional) |

**Response (200):**

```json
{
  "score": 85.5,
  "total_violations": 5,
  "open_violations": 4,
  "resolved_violations": 0,
  "false_positives": 1,
  "by_severity": {
    "high": 2,
    "medium": 2,
    "low": 1
  },
  "by_rule_type": {
    "encryption": 2,
    "consent": 1,
    "retention": 2
  }
}
```

---

### 7. Export Endpoint

#### GET /export

Export compliance report.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| scan_id | uuid | Scan to export (optional, defaults to latest) |
| format | string | json (only format for MVP) |

**Response (200):**

```json
{
  "report": {
    "generated_at": "2026-02-21T10:00:00Z",
    "policy": {
      "id": "uuid",
      "name": "GDPR Policy 2024"
    },
    "scan": {
      "id": "uuid",
      "score": 85.5,
      "violation_count": 5,
      "scan_date": "2026-02-21T10:00:00Z"
    },
    "violations": [...],
    "reviews": [
      {
        "violation_id": "uuid",
        "status": "false_positive",
        "reviewer": "user@example.com",
        "note": "This is test data",
        "timestamp": "2026-02-21T10:05:00Z"
      }
    ],
    "summary": {
      "total_violations": 5,
      "high_severity": 2,
      "medium_severity": 2,
      "low_severity": 1
    }
  }
}
```

---

### 8. Audit Endpoints

#### POST /api/audits

Create a new named audit session.

**Request:**
```json
{
  "name": "Q1 AML Review",
  "policy_id": "uuid"
}
```

**Response (201):**
```json
{
  "audit": {
    "id": "uuid",
    "name": "Q1 AML Review",
    "policy_id": "uuid",
    "status": "pending",
    "created_at": "2026-02-22T10:00:00Z"
  }
}
```

---

#### POST /api/policies/prebuilt

Load a prebuilt compliance policy pack.

**Request:**
```json
{
  "type": "aml" | "gdpr" | "soc2"
}
```

**Response (201):**
```json
{
  "policy": {
    "id": "uuid",
    "name": "AML Compliance Pack",
    "type": "prebuilt",
    "prebuilt_type": "aml",
    "rules_count": 10,
    "rules": [
      {
        "rule_id": "CTR_THRESHOLD",
        "name": "Currency Transaction Report Threshold",
        "type": "ctr_threshold",
        "severity": "CRITICAL",
        "threshold": 10000,
        "time_window": null,
        "conditions": { "field": "amount", "operator": ">=", "value": 10000 },
        "policy_excerpt": "Transactions exceeding $10,000 must be reported to FinCEN."
      }
    ],
    "created_at": "2026-02-22T10:00:00Z"
  }
}
```

---

#### POST /api/data/mapping/confirm

Confirm AI-suggested column mapping before scan runs.

**Request:**
```json
{
  "upload_id": "uuid",
  "mapping_config": {
    "amount": "base_amt",
    "sender_id": "nameOrig",
    "receiver_id": "nameDest",
    "timestamp": "step",
    "transaction_type": "type"
  },
  "temporal_scale": 24.0,
  "clarification_answers": [
    { "question_id": "q1", "answer": "yes" },
    { "question_id": "q2", "answer": "skip" }
  ]
}
```

**Response (201):**
```json
{
  "mapping_id": "uuid",
  "ready_to_scan": true
}
```

---

#### POST /api/data/mapping/readiness

Evaluate column mapping against **active, executable** rules for a policy (used by the mapping UI; same checks as scan preflight).

**Request:**

```json
{
  "policy_id": "uuid",
  "upload_id": "uuid",
  "mapping_config": {
    "account": "nameOrig",
    "amount": "amount",
    "step": "step",
    "type": "type",
    "recipient": "nameDest"
  },
  "mapping_confidence": {
    "account": 100,
    "amount": 72
  }
}
```

`mapping_confidence` is optional (per-field 0–100 scores; low scores add **warning** state).

**Response (200):**

```json
{
  "state": "ready",
  "missing_required": [],
  "invalid_columns": [],
  "warnings": [],
  "required_fields": ["account", "amount", "recipient", "step", "type"],
  "rule_dependencies": [
    {
      "rule_id": "CTR_THRESHOLD",
      "rule_name": "Currency Transaction Report Threshold",
      "is_active": true,
      "required_fields": ["account", "amount", "recipient", "step", "type"]
    }
  ],
  "sample_normalized_rows": [{ "account": "C1", "amount": 1000, "step": 1, "type": "TRANSFER" }]
}
```

`state` is `ready` | `warning` | `blocked`. When no executable rules exist, `state` is `blocked` with an explanatory warning.

---

#### POST /api/policies/generate-rules

Extract rules from **plain text** (e.g. pre-extracted PDF text). Same persistence shape as `/api/policies/ingest` rules.

**Request:**

```json
{
  "text": "…policy body…",
  "file_name": "optional.pdf"
}
```

**Response (201):** Same as ingest: `policy` + `rule_validation` (see above).

---

#### POST /api/policies/:id/rules/add-pdf

Upload a **PDF** (multipart) and extract rules with the same Gemini flow as ingest. New rules are **inserted** for the policy given by `:id`. Rules whose `rule_id` already exists on that policy are **skipped** (no error).

**Request:**

```
Content-Type: multipart/form-data
file: <PDF file>
```

**Response (200) — rules added:**

```json
{
  "added_count": 3,
  "rules": [ { "rule_id": "NEW_RULE", "name": "…", "description": "…", "type": "…", "severity": "HIGH", "conditions": { "field": "amount", "operator": ">=", "value": 10000 }, "policy_excerpt": "…" } ],
  "rule_validation": [
    { "rule_id": "NEW_RULE", "valid": true, "issues": [] }
  ]
}
```

**Response (200) — nothing new (all duplicates or empty extraction):**

```json
{
  "added_count": 0,
  "rules": []
}
```

When `added_count` is `0`, `rule_validation` is omitted.

Invalid or unsupported rules are still persisted with `is_active: false` when validation columns exist (same as ingest); `rule_validation` describes each row.

**Errors:** `400` (`VALIDATION_ERROR`) for missing/invalid PDF; `401` (`UNAUTHORIZED`); `404` (`NOT_FOUND`) if the policy does not exist; `500` on insert failures.

Structured logs: `component` `policies/add-pdf`, event `rules_quarantined` when any extracted rule fails engine validation.

---

#### GET /api/violations/cases

Get violations grouped by account ID for the dashboard case table.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| scan_id | uuid | Required — filter by scan |
| severity | string | Optional filter: CRITICAL, HIGH, MEDIUM |

**Response (200):**
```json
{
  "cases": [
    {
      "account_id": "C8234567",
      "violation_count": 4,
      "max_severity": "CRITICAL",
      "top_rule": "CTR_THRESHOLD",
      "total_amount": 47200.00,
      "violations": [
        {
          "id": "uuid",
          "rule_id": "CTR_THRESHOLD",
          "severity": "CRITICAL",
          "amount": 12500.00,
          "explanation": "Transaction of $12,500 exceeds $10,000 CTR threshold"
        }
      ]
    }
  ],
  "total_cases": 47,
  "total_violations": 312
}
```

---

#### POST /api/validate

Compute accuracy metrics against ground truth labels.

**Request:**
```json
{
  "scan_id": "uuid",
  "dataset": "ibm_aml" | "paysim",
  "label_column": "IsLaundering" | "isFraud"
}
```

**Response (200):**
```json
{
  "metrics": {
    "precision": 0.86,
    "recall": 0.95,
    "f1": 0.90,
    "fpr": 0.12,
    "tp": 3198,
    "fp": 423,
    "fn": 512,
    "tn": 44101
  },
  "per_rule": [
    {
      "rule_id": "CTR_THRESHOLD",
      "precision": 0.92,
      "recall": 0.98,
      "f1": 0.95
    }
  ],
  "summary": "Detected 86% of known violations with 12% false positive rate",
  "validated_against": "IBM_AML_IsLaundering",
  "total_labeled": 3710
}
```

---

## Error Responses

All endpoints may return error responses:

### 400 Bad Request

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request body",
  "details": [
    {"field": "email", "message": "Invalid email format"}
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

### 404 Not Found

```json
{
  "error": "NOT_FOUND",
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "request_id": "uuid"
}
```

---

## Scan Polling (No WebSockets)

Vercel serverless does not support persistent WebSocket connections. 
Use polling instead:
```typescript
// Poll every 1000ms until scan completes
const poll = setInterval(async () => {
  const res = await fetch(`/api/scan/${scanId}`);
  const { status, violation_count, compliance_score } = await res.json();
  if (status === 'completed' || status === 'failed') {
    clearInterval(poll);
    // redirect to dashboard
  }
}, 1000);
```

Maximum scan time is under 5 seconds for 50,000 rows. 
Polling interval of 1 second is invisible to users.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /scan/run | 10/minute |
| POST /api/scan/rescan | 10/minute |
| POST /policies/ingest | 5/minute |
| POST /api/policies/:id/rules/add-pdf | 5/minute |
| All other endpoints | 60/minute |

---

## Authentication

**Status: P0 (Required for MVP)**

All API endpoints require authentication via Supabase Auth.

### Auth Implementation

- Use Supabase Auth (built-in)
- All requests must include valid JWT token in Authorization header
- RLS (Row Level Security) policies enforce data isolation

### Auth Flow

```typescript
// Client-side: Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// All API calls include token
fetch('/api/violations', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
})
```

### Protected Endpoints

All endpoints require authentication:
- POST /api/policies/*
- POST /api/data/*
- POST /api/scan/*
- GET /api/violations
- PATCH /api/violations/*
- GET /api/compliance/*
- GET /api/scan/history
- GET /api/export/*

### RLS Policies

All database tables have RLS enabled:
- Users can only access their own organization's data
- Admin users can access all data in their organization
- No cross-tenant data access possible
