> ✅ Schema deployed to Supabase.
> Any changes to this doc must be accompanied by a migration script.
> Do not modify table structure directly — write ALTER TABLE statements.
# Database Schema: PolicyGuard AI

**Project:** PolicyGuard AI  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [gist.md](../gist.md) - Project overview
- [meta/Architecture.md](./meta/Architecture.md) - System architecture
- [enforcement-spec.md](./enforcement-spec.md) - Rule specifications
- [execution/RuleEngine.md](./execution/RuleEngine.md) - Execution abstraction

---

## Overview

Minimal normalized schema for MVP. Follows 3NF, ACID compliant via Supabase (PostgreSQL).

**Core Design Principles:**
- 4 tables only: policies, rules, scans, violations
- No premature abstraction
- Future extensions via simple additions

---

## Tables

### 1. policies

Upload or prebuilt policy storage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | REFERENCES auth.users(id) | Owner |
| name | TEXT | NOT NULL | Policy display name |
| type | TEXT | NOT NULL | 'pdf' or 'prebuilt' |
| prebuilt_type | TEXT | NULL | 'gdpr', 'soc2', 'aml' |
| file_url | TEXT | NULL | Supabase Storage URL for PDF |
| rules_count | INTEGER | DEFAULT 0 | Number of extracted rules |
| status | TEXT | DEFAULT 'active' | 'active' or 'archived' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_policies_user` ON (user_id)

---

### 2. rules

Extracted rules from policies.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| policy_id | UUID | REFERENCES policies(id) ON DELETE CASCADE | Parent policy |
| rule_id | TEXT | NOT NULL | Machine ID (e.g., 'CTR_THRESHOLD') |
| name | TEXT | NOT NULL | Human-readable name |
| type | TEXT | NOT NULL | Rule type category |
| description | TEXT | NULL | Rule description |
| threshold | DECIMAL(15,2) | NULL | Numeric threshold |
| time_window | INTEGER | NULL | Window in hours |
| severity | TEXT | NOT NULL | 'CRITICAL', 'HIGH', 'MEDIUM' |
| conditions | JSONB | NOT NULL | { field, operator, value } |
| policy_excerpt | TEXT | NULL | Original policy text |
| policy_section | TEXT | NULL | Policy section reference |
| is_active | BOOLEAN | DEFAULT TRUE | Whether rule is active |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_rules_policy` ON (policy_id)

---

### 3. scans

Compliance scan sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | REFERENCES auth.users(id) | Owner (or demo_uuid) |
| policy_id | UUID | REFERENCES policies(id) | Applied policy |
| temporal_scale | DECIMAL(5,2) | DEFAULT 1.0 | 1.0 (Hours) or 24.0 (Days) |
| mapping_config | JSONB | NOT NULL | { ruleField: csvHeader } |
| data_source | TEXT | NOT NULL | 'csv' |
| file_name | TEXT | NULL | Uploaded filename |
| record_count | INTEGER | DEFAULT 0 | Rows scanned (after sampling) |
| violation_count | INTEGER | DEFAULT 0 | Violations found |
| compliance_score | DECIMAL(5,2) | NULL | 0-100 score |
| status | TEXT | DEFAULT 'pending' | 'pending', 'running', 'completed', 'failed' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| completed_at | TIMESTAMPTZ | NULL | When scan finished (used for duration display) |

**Indexes:**
- `idx_scans_user` ON (user_id)
- `idx_scans_policy` ON (policy_id)
- `idx_scans_created` ON (created_at DESC)
- `idx_scans_status` ON (status) — for polling query performance

---

### 4. violations

Individual rule violations from scans.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| scan_id | UUID | REFERENCES scans(id) ON DELETE CASCADE | Parent scan |
| rule_id | TEXT | NOT NULL | Rule machine ID |
| rule_name | TEXT | NOT NULL | Human-readable rule name |
| severity | TEXT | NOT NULL | 'CRITICAL', 'HIGH', 'MEDIUM' |
| record_id | TEXT | NULL | Original row identifier |
| account | TEXT | NULL | Affected account |
| amount | DECIMAL(15,2) | NULL | Transaction amount |
| transaction_type | TEXT | NULL | Transaction type |
| evidence | JSONB | NULL | Full row data |
| threshold | DECIMAL(15,2) | NULL | Rule threshold |
| actual_value | DECIMAL(15,2) | NULL | Actual value |
| policy_excerpt | TEXT | NULL | Policy text |
| policy_section | TEXT | NULL | Policy section |
| explanation | TEXT | NULL | Generated explanation |
| status | TEXT | DEFAULT 'pending' | CHECK ('pending', 'approved', 'false_positive', 'disputed') |
| review_note | TEXT | NULL | Reviewer note |
| reviewed_by | UUID | REFERENCES auth.users(id) | Reviewer |
| reviewed_at | TIMESTAMPTZ | NULL | Review timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_violations_scan` ON (scan_id)
- `idx_violations_rule` ON (rule_id)
- `idx_violations_severity` ON (severity)
- `idx_violations_status` ON (status)
- `idx_violations_account` ON (account)

**Status Values:**

| Status | Description |
|--------|-------------|
| pending | Newly detected, not yet reviewed |
| approved | Confirmed violation |
| false_positive | Excluded from compliance score calculation entirely |
| disputed | Under review — remains in score until resolved |

> ⚠️ `false_positive` and `rejected` are NOT the same thing. 
> `false_positive` removes the violation from the score calculation. 
> `rejected` is not a valid status — do not use it.

---

## Entity Relationships

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  policies   │       │    rules    │       │    scans    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──1:N──│ policy_id   │       │ id (PK)     │
│ user_id     │       │ id (PK)     │       │ user_id     │
│ name        │       │ rule_id     │       │ policy_id   │
│ type        │       │ name        │       │ status      │
│ prebuilt    │       │ type        │       └──────┬──────┘
└─────────────┘       │ threshold   │              │
                      │ severity     │              │ 1:N
                      │ conditions   │              │
                      └─────────────┘              │
                                                  │
                                        ┌────────┴────────┐
                                        │  violations    │
                                        ├────────────────┤
                                        │ id (PK)        │
                                        │ scan_id (FK)   │
                                        │ rule_id        │
                                        │ severity       │
                                        │ status         │
                                        │ explanation    │
                                        └────────────────┘
```

---

## Queries (Common)

### Get user's scan history with violation counts
```sql
SELECT 
    s.*,
    COUNT(v.id) FILTER (WHERE v.status = 'pending') as pending_violations,
    COUNT(v.id) FILTER (WHERE v.status = 'approved') as approved_violations
FROM scans s
LEFT JOIN violations v ON v.scan_id = s.id
WHERE s.user_id = $user_id
GROUP BY s.id
ORDER BY s.created_at DESC;
```

### Get violations by severity
```sql
SELECT 
    severity,
    COUNT(*) as count
FROM violations
WHERE scan_id = $scan_id
GROUP BY severity
ORDER BY 
    CASE severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
    END;
```

### Diff: Compare current scan with previous scan
```sql
-- Get new violations (in current but not in previous scan)
SELECT cv.*
FROM violations cv
WHERE cv.scan_id = $current_scan_id
AND NOT EXISTS (
    SELECT 1 FROM violations pv
    WHERE pv.scan_id = $previous_scan_id
    AND pv.rule_id = cv.rule_id
    AND pv.record_id = cv.record_id
);
```

---

## Row Level Security (RLS) & Demo Mode

All tables have RLS enabled to ensure data isolation.

**Demo vs. Production Logic:**
- **Production:** `user_id` is the authenticated Supabase `auth.uid()`.
- **Demo Mode:** `user_id` is set to a fixed "Demo UUID" (`00000000-0000-0000-0000-000000000001`) or an ephemeral session UUID.
- **Security:** RLS policies handle both cases seamlessly.

```sql
-- Enable RLS on all tables
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their own data (Production or Demo)
CREATE POLICY "Users see own data" ON policies
    FOR ALL USING (user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid));
```

---

## Extension Points (Post-MVP)

| Table | Extensions |
|-------|------------|
| policies | Add version tracking, file_hash |
| rules | Add rule priority, category |
| scans | Add scan_snapshots table for diffs |
| violations | Add evidence_archive, attachments |

---

## Why This Schema Works

| Property | How Achieved |
|----------|-------------|
| Normalized | 3NF, no redundant data |
| ACID | Supabase/PostgreSQL handles |
| N+1 Free | Proper indexes + JOIN queries |
| Scalable | Add indexes as needed |
| Simple | 4 tables, clear relationships |
