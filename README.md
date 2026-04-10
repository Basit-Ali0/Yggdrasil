# Yggdrasil

**Autonomous policy-to-data compliance engine.** Upload a regulatory PDF, connect your dataset, and get explainable compliance violations — with every finding traced back to the exact policy clause. No auditors. No black boxes.

---

## What It Does

Yggdrasil bridges the gap between PDF policy documents and database enforcement. The system extracts enforceable rules from regulatory text using AI, maps them to your data schema, and runs a deterministic scan that produces audit-ready violations with full explainability.

**Three steps:**

1. **Upload Policy** — Upload any regulatory PDF (AML, GDPR, SOC2, or custom). AI extracts structured, enforceable rules with compound condition logic.
2. **Connect Data** — Upload your CSV dataset. AI detects the schema and suggests column mappings. You approve before anything runs.
3. **Get Results** — Violations ranked by severity and confidence, each with the matched policy excerpt, evidence grid, and a natural-language explanation. No AI calls in the enforcement loop — explanations are deterministic templates.

---

## Key Design Decisions

- **Deterministic enforcement.** The rule engine is pure logic — no ML models in the critical path. Rules are evaluated as compound boolean expressions (`AND`/`OR` trees) against each record. This makes results reproducible and audit-ready.
- **Explainability by default.** Every violation includes the exact policy excerpt it violates, the evidence from your data, and a condition summary. Explanations are generated from string templates, not LLM calls.
- **Signal Specificity Framework.** Rules extracted from PDFs must combine multiple signals (behavioral + temporal + relational) to reach a minimum specificity threshold before they can fire. Single-threshold rules are rejected to minimize false positives.
- **Bayesian feedback loop.** When you approve or dismiss a violation, that feedback updates a per-rule precision model: `precision = (1 + TP) / (2 + TP + FP)`. Rules that produce false positives lose confidence over time. Your reviews make the next scan better.
- **Transparent mapping.** Column mappings are suggested by AI but require explicit user approval. No data transformations happen behind the scenes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5.7 |
| Database | Supabase (PostgreSQL + Row-Level Security) |
| Auth | Supabase Auth (SSR cookies + JWT bearer tokens) |
| AI | Google Gemini 2.5 Flash via Vercel AI SDK |
| PDF Parsing | unpdf (serverless-compatible) |
| CSV Parsing | Papa Parse |
| State | Zustand |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI, Lucide icons |
| Charts | Recharts |
| Validation | Zod 4 |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── audits/              # Create audit + load policy
│   │   ├── policies/
│   │   │   ├── ingest/          # PDF upload + Gemini rule extraction
│   │   │   ├── generate-rules/  # Text-to-rules extraction
│   │   │   ├── prebuilt/        # Load AML/GDPR/SOC2 rule packs
│   │   │   └── [id]/rules/     # Rule CRUD + add from PDF/prebuilt
│   │   ├── data/
│   │   │   ├── upload/          # CSV upload + schema detection
│   │   │   ├── mapping/confirm/ # Confirm column mapping
│   │   │   └── pii-scan/       # PII detection in uploaded data
│   │   ├── scan/
│   │   │   ├── run/             # Trigger compliance scan
│   │   │   ├── [id]/           # Poll scan status
│   │   │   └── history/        # Scan history
│   │   ├── violations/
│   │   │   ├── [id]/           # Violation detail + review (approve/dismiss)
│   │   │   ├── [id]/remediation/ # AI-generated remediation steps
│   │   │   └── cases/          # Violations grouped by account
│   │   ├── compliance/score/    # Compliance score breakdown
│   │   ├── export/              # Export report as JSON
│   │   ├── knowledge/gdpr/      # GDPR articles + historical fines
│   │   └── validate/            # Validate against ground-truth labels
│   ├── audit/
│   │   ├── new/                 # Audit wizard: policy selection
│   │   └── [id]/               # Upload, rules, mapping, scanning steps
│   ├── dashboard/
│   │   ├── page.tsx             # Scan history overview
│   │   └── [scanId]/           # Violation dashboard + cases view
│   ├── page.tsx                 # Landing page
│   ├── login/ & signup/         # Auth pages
│   └── export/ & history/       # Report export, scan history
├── lib/
│   ├── engine/
│   │   ├── in-memory-backend.ts # Core rule executor (single-tx + windowed)
│   │   ├── rule-executor.ts     # Orchestrator: normalize, route, score
│   │   ├── explainability.ts    # Deterministic violation explanations
│   │   ├── scoring.ts           # Confidence scoring + Bayesian precision
│   │   ├── schema-adapter.ts    # Column mapping + normalization
│   │   ├── temporal.ts          # Time window calculations
│   │   ├── pii-executor.ts      # PII pattern detection
│   │   └── rule-quality-validator.ts # Rule quality scoring
│   ├── policies/
│   │   ├── aml.ts               # 11 AML/FinCEN rules
│   │   ├── gdpr.ts              # 14+ GDPR category rules
│   │   └── soc2.ts              # 5 SOC2 trust principle rules
│   ├── validators/              # Zod schemas for API validation
│   ├── types.ts                 # Core TypeScript interfaces
│   ├── contracts.ts             # API request/response types
│   ├── gemini.ts                # Gemini wrapper (retry + circuit breaker)
│   ├── supabase.ts              # Server-side Supabase client
│   └── api.ts                   # HTTP client helper
├── stores/                      # Zustand stores (audit, auth, violations, etc.)
├── components/
│   ├── evidence-drawer.tsx      # Violation evidence panel
│   ├── app-sidebar.tsx          # Navigation sidebar
│   └── ui/                     # shadcn/ui primitives
└── middleware.ts                # Auth middleware
```

---

## Rule Engine

### How Rules Are Evaluated

```
RuleExecutor.executeAll(rules, records, config)
  │
  ├─ Normalize records (CSV strings → typed values)
  ├─ Sample if > 50K rows
  │
  └─ For each active rule:
       │
       ├─ Route by rule.type
       │   ├─ WINDOWED (aggregation, velocity, structuring, dormant_reactivation, round_amount)
       │   │   → Group by account → evaluate within time windows
       │   └─ SINGLE-TX (everything else)
       │       → Evaluate compound conditions per record
       │
       ├─ evaluateLogic(conditions, record)
       │   ├─ { AND: [...] } → all must match
       │   ├─ { OR: [...] }  → any must match
       │   └─ { field, operator, value } → leaf condition check
       │
       ├─ Apply confidence scoring
       │   ├─ Rule quality score
       │   ├─ Signal specificity boost (compound conditions)
       │   ├─ Statistical anomaly detection
       │   └─ Bayesian historical precision
       │
       └─ Cap at 1000 violations per rule
```

### Supported Operators

| Operator | Aliases | Description |
|---|---|---|
| `>=` | `greater_than_or_equal`, `gte` | Greater than or equal |
| `>` | `greater_than`, `gt` | Greater than |
| `<=` | `less_than_or_equal`, `lte` | Less than or equal |
| `<` | `less_than`, `lt` | Less than |
| `==` | `equals`, `eq` | Equality (with type coercion) |
| `!=` | `not_equals`, `neq` | Inequality |
| `IN` | — | Set membership |
| `BETWEEN` | — | Range check `[min, max]` |
| `exists` | — | Field is present and non-empty |
| `not_exists` | — | Field is missing or empty |
| `contains` | `includes` | Case-insensitive substring match |
| `MATCH` | `regex` | Regular expression test |

Cross-field comparisons are supported via `value_type: "field"`, where the `value` references another column name instead of a literal.

### Type Coercion

CSV files produce string values. The engine coerces automatically:
- `"true"` / `"false"` ↔ `true` / `false`
- `"16"` ↔ `16`
- Numeric comparisons use `parseFloat()` on both sides

---

## Prebuilt Policy Frameworks

### AML / FinCEN (11 rules)
Currency Transaction Reports, structuring detection, velocity limits, dormant account reactivation, round amount patterns, balance mismatches, and suspicious activity thresholds.

### GDPR (14+ categories)
Consent management, data protection officer requirements, encryption at rest, marketing consent, personal data handling, privacy impact assessments, processing records, right of access/erasure/information, and third-country transfer safeguards.

### SOC2 (5 trust principles)
Security (logical access controls), Availability, Confidentiality (encryption requirements), Processing Integrity, and Privacy.

### Custom PDF
Upload any regulatory document. Gemini extracts rules using the Signal Specificity Framework, requiring each rule to combine multiple signals for a minimum combined specificity of 2.0.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Set `NEXT_PUBLIC_DEMO_MODE=true` to bypass authentication with a hardcoded demo session.

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

---

## Database Schema

Yggdrasil uses Supabase PostgreSQL with Row-Level Security. All tables are filtered by `auth.uid()` via RLS policies — each user only sees their own data.

### Relationships

```
auth.users
    └── policies (user_id)
        └── rules (policy_id)
    └── scans (user_id, policy_id)
        ├── violations (scan_id)
        └── pii_findings (scan_id)
```

### `policies`

Stores policy metadata. One policy per audit, linked to extracted rules.

| Column | Type | Description |
|---|---|---|
| `id` | UUID, PK | |
| `user_id` | UUID, FK | Owner (from `auth.uid()`) |
| `name` | text | Policy name (e.g., "GDPR Compliance") |
| `type` | text | `'prebuilt'` or `'custom_pdf'` |
| `prebuilt_type` | text | `'aml'`, `'gdpr'`, `'soc2'` for prebuilt policies |
| `rules_count` | integer | Total rules in policy |
| `status` | text | `'active'` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Used for dirty detection (policy changed since last scan) |

### `rules`

Extracted compliance rules with compound condition logic and Bayesian feedback counters.

| Column | Type | Description |
|---|---|---|
| `id` | UUID, PK | |
| `policy_id` | UUID, FK | Parent policy |
| `rule_id` | text | Unique ID within policy (e.g., `'aml_rule_1'`) |
| `name` | text | Human-readable name |
| `type` | text | Execution type: `'single_transaction'`, `'aggregation'`, `'velocity'`, `'structuring'`, `'dormant_reactivation'`, `'round_amount'` |
| `severity` | text | `'CRITICAL'`, `'HIGH'`, `'MEDIUM'` |
| `threshold` | numeric | Rule threshold value |
| `time_window` | integer | Time window in hours (windowed rules) |
| `conditions` | jsonb | Compound boolean logic tree (`AND`/`OR` with leaf conditions) |
| `policy_excerpt` | text | Quote from regulatory document |
| `policy_section` | text | Section reference |
| `description` | text | JSON string with rule text + optional `historical_context` |
| `is_active` | boolean | Whether rule fires during scans |
| `approved_count` | integer | User-confirmed true positives (Bayesian feedback) |
| `false_positive_count` | integer | User-dismissed false positives (Bayesian feedback) |
| `created_at` | timestamptz | |

**Conditions JSONB example:**
```json
{
  "AND": [
    { "field": "amount", "operator": ">=", "value": 10000 },
    { "field": "transaction_type", "operator": "IN", "value": ["DEBIT", "WIRE"] }
  ]
}
```

### `scans`

Scan execution records with compliance scores and score history for trend tracking.

| Column | Type | Description |
|---|---|---|
| `id` | UUID, PK | |
| `user_id` | UUID, FK | |
| `policy_id` | UUID, FK | Policy scanned against |
| `temporal_scale` | numeric | Time scaling factor (`1.0` or `24.0`) |
| `mapping_config` | jsonb | Column mappings (CSV column → schema field) |
| `data_source` | text | `'csv'` |
| `file_name` | text | Original uploaded file name |
| `record_count` | integer | Rows scanned (capped at 50K) |
| `violation_count` | integer | True violation count (pre-cap) |
| `compliance_score` | numeric | Score 0–100 |
| `status` | text | `'pending'`, `'running'`, `'completed'`, `'failed'` |
| `created_at` | timestamptz | |
| `completed_at` | timestamptz | |
| `upload_id` | UUID | Reference to in-memory upload store |
| `mapping_id` | UUID | Reference to in-memory mapping store |
| `audit_id` | UUID | Logical audit session |
| `audit_name` | text | User-provided audit name |
| `score_history` | jsonb | Array of `{ score, timestamp, action, violation_id }` for compliance trend chart |

**Score history JSONB example:**
```json
[
  { "score": 85.2, "timestamp": "2026-02-22T10:00:00Z", "action": "scan_completed", "violation_id": null },
  { "score": 87.1, "timestamp": "2026-02-22T10:05:00Z", "action": "false_positive", "violation_id": "abc-123" }
]
```

### `violations`

Detected compliance violations with evidence, explanations, and review status.

| Column | Type | Description |
|---|---|---|
| `id` | UUID, PK | |
| `scan_id` | UUID, FK | Parent scan |
| `rule_id` | text | Violated rule ID |
| `rule_name` | text | Rule name |
| `severity` | text | `'CRITICAL'`, `'HIGH'`, `'MEDIUM'` |
| `record_id` | text | Row ID from source data |
| `account` | text | Account/entity identifier |
| `amount` | numeric | Transaction amount |
| `transaction_type` | text | Transaction type |
| `evidence` | jsonb | Matched field values from the record |
| `threshold` | numeric | Rule threshold breached |
| `actual_value` | numeric | Actual value that triggered violation |
| `policy_excerpt` | text | Policy clause violated |
| `policy_section` | text | Policy section reference |
| `explanation` | text | Deterministic explanation (template-generated) |
| `status` | text | `'pending'`, `'approved'`, `'false_positive'` |
| `review_note` | text | Reviewer comments |
| `reviewed_by` | UUID | Reviewer user ID |
| `reviewed_at` | timestamptz | |
| `created_at` | timestamptz | |

### `pii_findings`

PII detection results from uploaded datasets. Initially stored with `upload_id` only, then linked to `scan_id` after scan completes.

| Column | Type | Description |
|---|---|---|
| `id` | UUID, PK | |
| `scan_id` | UUID, FK, nullable | Linked after scan creation |
| `upload_id` | UUID | Upload that was scanned for PII |
| `column_name` | text | Column containing PII |
| `pii_type` | text | `'email'`, `'phone'`, `'ssn'`, `'name'`, `'address'`, `'credit_card'`, etc. |
| `severity` | text | `'CRITICAL'`, `'HIGH'`, `'MEDIUM'` |
| `confidence` | numeric | Detection confidence (0–1) |
| `match_count` | integer | Rows with potential PII |
| `total_rows` | integer | Total rows analyzed |
| `sample_values` | jsonb | Masked sample values |
| `detection_query` | text | Regex pattern used |
| `violation_text` | text | PII risk description |
| `suggestion` | text | Remediation: `'hash'`, `'encrypt'`, `'remove'` |
| `status` | text | `'open'`, `'resolved'`, `'ignored'` |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz | |
| `resolved_by` | UUID | |

### RPC Functions

```sql
-- Bayesian feedback: atomically increment rule precision counters
increment_rule_stat(target_policy_id UUID, target_rule_id TEXT, stat_column TEXT) → VOID
```

### Design Rationale

- **JSONB for conditions:** Rules support arbitrarily nested AND/OR logic trees. JSONB allows flexible schema without join overhead.
- **Score history on scans:** Tracking per-review score changes enables compliance trend visualization without a separate table.
- **Bayesian counters on rules:** `approved_count` and `false_positive_count` enable the precision formula `(1 + TP) / (2 + TP + FP)` that improves rule confidence over time.
- **PII findings linked by upload_id:** PII detection runs at upload time (before a scan exists), so findings are initially stored by `upload_id` and linked to `scan_id` after scan completion.
- **In-memory upload/mapping stores:** CSV data and column mappings are kept in server memory during the audit flow, not persisted to the database. Only the final scan results are stored.

---

## Demo Datasets

Included in `public/` for testing:

| File | Description |
|---|---|
| `fraud_detection_subset_50k.csv` | 50K-row AML/fraud detection dataset |
| `gdpr_text.csv` | GDPR article text (chapter, article, content) |
| `gdpr_violations.csv` | Historical GDPR enforcement actions (fines, authorities, articles violated) |

The engine auto-detects known dataset formats (IBM AML, PaySim) and adjusts temporal scaling accordingly.

---

## API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/audits` | POST | Create audit + initialize policy |
| `/api/policies/ingest` | POST | Upload PDF, extract rules via Gemini |
| `/api/policies/prebuilt` | POST | Load AML/GDPR/SOC2 rule pack |
| `/api/data/upload` | POST | Upload CSV, detect schema, suggest mappings |
| `/api/data/mapping/confirm` | POST | Confirm column mapping |
| `/api/data/pii-scan` | POST | Scan uploaded data for PII |
| `/api/scan/run` | POST | Run compliance scan |
| `/api/scan/{id}` | GET | Poll scan status |
| `/api/violations` | GET | List violations for a scan |
| `/api/violations/{id}` | GET, PATCH | Get detail / review (approve or dismiss) |
| `/api/violations/{id}/remediation` | POST | Generate AI remediation steps |
| `/api/violations/cases` | GET | Violations grouped by account |
| `/api/compliance/score` | GET | Compliance score breakdown |
| `/api/export` | GET | Export full report as JSON |
| `/api/validate` | POST | Validate scan against ground-truth labels |

---

## Audit Flow

```
1. Create Audit         POST /api/audits
   Select framework     (aml | gdpr | soc2 | pdf)
        │
2. Upload Data          POST /api/data/upload
   CSV file             → schema detection + AI mapping suggestion
        │
3. Review Rules         GET policy rules
   Toggle on/off        per-rule activation
        │
4. Confirm Mapping      POST /api/data/mapping/confirm
   Approve columns      → user signs off on schema mapping
        │
5. Run Scan             POST /api/scan/run
   Engine executes      → deterministic rule evaluation
        │
6. Review Results       GET /api/violations
   Dashboard            → violations by severity, account, rule
   Evidence drawer      → policy excerpt, condition match, explanation
   Approve/Dismiss      → Bayesian feedback updates rule precision
        │
7. Export Report        GET /api/export
```

---

## Confidence Scoring

Each violation receives a confidence score (0–1) computed from:

```
score = rule_quality              # structural quality of the rule
      + signal_specificity_boost  # bonus for compound AND conditions
      + statistical_anomaly       # how unusual the value is vs. dataset
      + bayesian_precision        # (1 + TP) / (2 + TP + FP) from reviews
      + criticality_weight        # CRITICAL > HIGH > MEDIUM
```

The Bayesian component means the system improves with use. Rules that consistently produce false positives are downweighted. Rules that catch real issues gain confidence.

---

## PII Detection

Before scanning, the system optionally checks uploaded data for personally identifiable information:

- Email addresses, phone numbers, SSNs
- Names, physical addresses, dates of birth
- Credit card numbers, IP addresses
- Passport numbers, national IDs, bank accounts

Detection is regex-based on a sample of 20 rows. Findings are surfaced as warnings — the scan proceeds regardless, but the user is informed.

---

## License

Private.
