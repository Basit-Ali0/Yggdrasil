# Policy Extraction Pipeline: PolicyGuard AI

> **⚠️ DEPRECATED:** This document's content has been merged into [LLMSystemPrompts.md](./LLMSystemPrompts.md). Please refer to that document for the latest technical specifications.
>
> **Reason:** Technical content moved to LLMSystemPrompts.md. Pipeline diagrams preserved here for reference.

**Project:** PolicyGuard AI  
**Status:** P0 (MVP)  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

---

## Overview

This document details the end-to-end policy extraction pipeline that converts PDF policy documents into structured, enforceable JSON rules.

**Core Principles:**
- **Explainable AI** - Every rule maps to specific policy text
- **User Control** - Users can edit, add, remove rules
- **Reusable** - Policies stored as JSON for future scans
- **Secure** - Data encrypted with RLS protection

---

## Pipeline Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Upload    │───▶│   Extract   │───▶│   Parse &   │───▶│   Store &   │
│   PDF       │    │   Text      │    │   Extract   │    │   Encrypt   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                              │
                                              ▼
                                      ┌─────────────┐
                                      │   User      │
                                      │   Review    │
                                      └─────────────┘
```

---

## Step 1: PDF Upload & Validation

### Frontend UI

| Element | Description |
|---------|-------------|
| Drag-drop zone | Accept .pdf files |
| File picker | Alternative to drag-drop |
| Progress bar | Show upload progress |
| Validation | Check file type, size |

### Backend Processing

```typescript
// API: POST /api/policies/ingest
interface UploadResponse {
  policy: {
    id: string;
    name: string;
    status: 'processing' | 'ready' | 'error';
    page_count: number;
  }
}
```

### Validation Rules

| Rule | Action |
|------|--------|
| File type ≠ PDF | Reject with error |
| File > 10MB | Warn, allow proceed |
| Empty PDF | Reject with error |
| Scanned (image only) | Flag for OCR |

---

## Step 2: Text Extraction

### Native PDFs (Selectable Text)

**Library:** pdf-parse or PyMuPDF (fitz)

```typescript
import pdf from 'pdf-parse';

async function extractText(buffer: Buffer) {
  const data = await pdf(buffer);
  return {
    text: data.text,
    pages: data.numpages,
    metadata: data.metadata
  };
}
```

### Scanned PDFs (Images)

**OCR Options:**

| Option | Accuracy | Cost | Setup |
|--------|----------|------|-------|
| Tesseract.js | Good | Free | Easy |
| AWS Textract | Excellent | Pay/page | Medium |
| Google Document AI | Excellent | Pay/page | Complex |
| OlmOCR (VLM) | Best | Free/self-host | Medium |

**Hybrid Detection:**

```typescript
async function extractWithOCR(file: Buffer) {
  // Try native extraction first
  const native = await extractText(file);
  
  // If minimal text, use OCR
  if (native.text.length < 100) {
    return await runOCR(file);
  }
  
  return native;
}
```

---

## Step 3: LLM Rule Extraction

### Prompt Structure

```typescript
const EXTRACTION_PROMPT = `
You are a compliance expert. Extract structured rules from this policy document.

For each rule, identify:
1. Rule type: encryption | consent | retention | prohibited | access | format
2. Description: What the rule requires
3. Severity: critical | high | medium | low
4. Conditions: When the rule applies
5. Source text: Exact policy text that generated this rule

Output as JSON array.
`;
```

### LLM Output Schema

```json
{
  "rules": [
    {
      "id": "rule_001",
      "type": "encryption",
      "description": "Email addresses must be encrypted at rest",
      "severity": "high",
      "policy_excerpt": "All personal data including email addresses must be encrypted at rest...",
      "conditions": {
        "field": "email",
        "operator": "exists",
        "value": null
      },
      "confidence": 0.95,
      "needs_review": false
    }
  ]
}
```

### Explainable AI Output

Every rule includes:

| Field | Purpose |
|-------|---------|
| `policy_excerpt` | Exact text from PDF |
| `confidence` | LLM confidence score |
| `reasoning` | Why this rule was extracted |

---

## Step 4: Clarification Questions

When LLM needs more context from user (not visible in data):

### Why Clarification is Needed

Some things cannot be determined from data alone:
- **Soft delete vs hard delete** - Is "deleted" data actually removed?
- **Retention periods** - How long is data kept?
- **Environment scope** - Does policy apply to prod/staging/both?
- **Data relationships** - How are tables connected?

### Trigger Conditions

```typescript
const CLARIFICATION_TRIGGERS = {
  AMBIGUOUS_POLICY: 'Multiple interpretations possible',
  MISSING_CONTEXT: 'Need environment/staging info',
  CONFLICTING_RULES: 'Rules contradict each other',
  INCOMPLETE_SCAN: 'Could not access all tables',
  DATA_AMBIGUITY: 'Cannot determine from data structure alone'
};
```

### Example Clarification Questions

| Question | When Triggered |
|----------|---------------|
| "When a user deletes their profile, is the data soft-deleted (marked) or hard-deleted (removed)?" | users table has deleted_at but no is_deleted column |
| "What's your data retention period for customer records?" | No explicit retention policy in schema |
| "Does this compliance policy apply to production data, staging, or both?" | Multiple environments detected |
| "Are you using foreign keys to define relationships, or are they implicit?" | No foreign keys found but tables seem related |
| "Do you have a separate archive table for deleted records?" | Deleted records found without clear deletion policy |

### Data Ingestion Ambiguity

When user uploads CSV/JSON files:

| Ambiguity | Question |
|-----------|----------|
| Multiple files | "These files seem related. Would you like to define relationships between them?" |
| Column naming | "I see 'email' and 'contact_email' - are these the same field?" |
| Data format | "This date field has mixed formats. Should I normalize to ISO 8601?" |
| Missing relationships | "I couldn't find foreign keys. Are these tables related?" |

### User Interaction

```
┌─────────────────────────────────────────────┐
│  We found 5 rules but need clarification    │
├─────────────────────────────────────────────┤
│  Q1: Does this policy apply to production  │
│      data, staging, or both?               │
│      ○ Production only                      │
│      ○ Staging only                        │
│      ○ Both                                │
│                                             │
│  [Skip for Now]  [Submit Answers]          │
└─────────────────────────────────────────────┘
```

### Response Templates

| Scenario | Template |
|----------|----------|
| Need clarification | "I found {N} rules, but need clarification on {topic} before finalizing." |
| Low confidence | "Some rules have low confidence. Please review highlighted rules." |
| Success | "Successfully extracted {N} rules from your policy." |

---

## Step 5: User Review & Editing

### UI: Rule Editor

```
┌──────────────────────────────────────────────────────────┐
│  Extracted Rules (5)                          [Save All] │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │ Rule 1: Email Encryption              [Edit][Delete]│  │
│  │ Type: encryption  |  Severity: high                │  │
│  │ "Email addresses must be encrypted at rest"        │  │
│  │ Source: Page 3, Paragraph 2                        │  │
│  │ Confidence: 95%                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [+ Add New Rule]                                       │
└──────────────────────────────────────────────────────────┘
```

### Editing Capabilities

| Action | Description |
|--------|-------------|
| Edit rule | Modify any field |
| Add rule | Create new rule manually |
| Delete rule | Remove rule |
| Reorder | Change rule priority |
| Add note | Internal notes for team |

---

## Step 6: JSON Storage with RLS

### Database Schema

```sql
-- Policies table
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source_pdf_name TEXT,
  extracted_rules JSONB NOT NULL DEFAULT '[]',
  raw_llm_output JSONB,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy versions for audit
CREATE TABLE policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  version INTEGER NOT NULL,
  rules JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users own their policies"
  ON policies FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users own their policy versions"
  ON policy_versions FOR ALL
  USING (auth.uid() = user_id);
```

### Storage Optimization

- **Don't store PDF** - Store only extracted JSON
- **Compress** - Use JSON compression for large policies
- **Version** - Track all changes with versions

---

## Step 6b: Multi-File Data Upload + Relations

### Multiple File Upload

Users can upload multiple CSV/JSON files:

```typescript
interface MultiFileUpload {
  files: File[];
  relations?: DataRelation[];
}

interface DataRelation {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}
```

### Auto-Detection of Relations

LLM heuristics can suggest relationships:

```typescript
// Auto-detect from column names
const RELATION_HEURISTICS = [
  { pattern: /(.+)_id/, matches: /(.+)/, type: 'one-to-many' },
  { pattern: /^(from_|to_)/, type: 'many-to-many' }
];

function detectRelations(tables: Table[]): Suggestion[] {
  // Suggest relations based on naming patterns
}
```

### User Interface for Relations

```
┌─────────────────────────────────────────────────────┐
│  Data Relationships                            [Save]│
├─────────────────────────────────────────────────────┤
│  Suggested Relations:                              │
│  ┌─────────────────────────────────────────────┐   │
│  │ users.id → orders.user_id (one-to-many)   │   │
│  │ [✓ Confirm]  [Ignore]                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  Add Custom Relation:                               │
│  From: [table] Column: [col]                       │
│  To:   [table] Column: [col]                       │
│  Type: [one-to-one ▼]                              │
│  [+ Add]                                            │
└─────────────────────────────────────────────────────┘
```

### Why Relations Matter

- **Holistic reviews** - Understand cascading violations
- **Dependency analysis** - Know what breaks when fixing
- **Complete picture** - See how data flows through system

---

## Step 7: SQL Generation for Violations

### Policy → SQL Mapping

```typescript
const POLICY_TO_SQL = {
  encryption: (rule) => `
    SELECT table_name, column_name 
    FROM columns 
    WHERE data_classification = 'PII' 
      AND encryption_enabled = false
  `,
  
  retention: (rule) => `
    SELECT table_name, COUNT(*) as expired_records
    FROM records
    WHERE created_at < NOW() - INTERVAL '${rule.retention_days} days'
    GROUP BY table_name
  `,
  
  consent: (rule) => `
    SELECT table_name, column_name, COUNT(*) as missing_consent
    FROM records r
    JOIN columns c ON r.table_id = c.table_id
    WHERE c.requires_consent = true
      AND r.consent_status != 'granted'
    GROUP BY table_name, column_name
  `
};
```

### Heuristics for Column Detection

```typescript
const COLUMN_HEURISTICS = {
  email: /email|mail|e-mail|contact_email/i,
  phone: /phone|mobile|tel|cell/i,
  name: /name|full_name|first_name|last_name/i,
  address: /address|street|city|zip|postal/i,
  ssn: /ssn|social|government_id/i,
  dob: /birth|date_of_birth|dob/i
};

// Auto-detect column types
function detectColumnType(columnName: string): string {
  for (const [type, regex] of Object.entries(COLUMN_HEURISTICS)) {
    if (regex.test(columnName)) return type;
  }
  return 'unknown';
}
```

---

## Step 8: Remediation Generation

### Per-Violation Output

```json
{
  "violation_id": "v001",
  "rule_id": "rule_001",
  "table": "users",
  "column": "email",
  "offender_count": 4200,
  "severity": "high",
  "policy_excerpt": "All personal data must be encrypted...",
  "explanation": "Found 4,200 unencrypted email addresses",
  "remediation": {
    "step_1": "Enable encryption at rest for users table",
    "step_2": "Re-encrypt existing email column",
    "step_3": "Verify encryption with SELECT pgp_sym_decrypt..."
  },
  "sql_fix": "ALTER TABLE users ALTER COLUMN email TYPE bytea;"
}
```

---

## Review Process

### Myopic (Single Violation)

Quick scan showing individual violations:

```
Violations Found: 5
├─ Email not encrypted (4,200 records)
├─ Phone not encrypted (3,100 records)
└─ Missing consent (500 records)
```

### Holistic (Dependency-Aware)

Advanced review showing dependencies:

```
Risk Assessment:
├─ users.email → HIGH CASCADE RISK
│   └─ Referenced by 12 downstream tables
├─ orders.phone → MEDIUM CASCADE RISK
│   └─ Referenced by 3 downstream tables
└─ logs.address → LOW RISK
    └─ No dependencies
```

**Agent can overwrite myopic review with holistic view when complete.**

---

## Complete Flow Diagram

```
User uploads PDF
       │
       ▼
┌──────────────┐
│ Extract Text │──────▶ [If scanned: Run OCR]
└──────────────┘
       │
       ▼
┌──────────────┐
│ LLM Extract  │──────▶ [If unclear: Ask clarification]
└──────────────┘
       │
       ▼
┌──────────────┐
│ User Review  │──────▶ [Edit/Add/Delete rules]
└──────────────┘
       │
       ▼
┌──────────────┐
│ Store JSON   │──────▶ [Encrypt + RLS]
└──────────────┘
       │
       ▼
┌──────────────┐
│ Generate SQL │──────▶ [For violation detection]
└──────────────┘
       │
       ▼
┌──────────────┐
│ Run Scan     │──────▶ [Detect violations]
└──────────────┘
       │
       ▼
┌──────────────┐
│ Show Results │──────▶ [With remediation + offender count]
└──────────────┘
```

---

## Related Docs

- [Integrations.md](./Integrations.md) - Data source integrations
- [SmartEngine.md](./SmartEngine.md) - RAG + pgvector for smarter heuristics
- [Telemetry.md](./Telemetry.md) - Privacy-first anonymous telemetry
