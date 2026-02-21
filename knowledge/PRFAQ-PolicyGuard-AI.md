# PRFAQ: PolicyGuard AI

> **⚠️ DEPRECATED:** This document's content has been merged into [Feature-PolicyGuard-AI.md](./Feature-PolicyGuard-AI.md). Please refer to that document for the latest specifications.
>
> **Reason:** Duplicate content. Core information preserved in Feature doc.

**Feature:** PolicyGuard AI — Autonomous Policy-to-Data Compliance Engine
**Mode:** N/A
**Audience:** Engineering (Primary), Product, Design, Judges
**Status:** v1 — ready for implementation

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**

- [Brief-PolicyGuard-AI.md](./Brief-PolicyGuard-AI.md)
- [Integrations.md](./Integrations.md) - (data source integration details)
- [gist.md](../gist.md) - (condensed project overview)


---

## PRESS RELEASE (INTERNAL)

### PolicyGuard AI Launches — The First Autonomous Policy-to-Data Compliance Engine

PolicyGuard AI transforms static PDF policy documents into executable database enforcement rules, enabling continuous, explainable compliance monitoring with human oversight.

**The Problem:** Organizations worldwide spend countless hours manually interpreting policy documents and checking databases for compliance violations. This slow, error-prone process leaves compliance teams overwhelmed and auditors frustrated with point-in-time snapshots instead of continuous monitoring.

**The Solution:** PolicyGuard AI bridges the gap between policy and data. Upload a PDF policy, connect to your database, and receive instant, explainable violation reports. Every finding includes the policy excerpt, data evidence, and risk severity — no black-box answers.

**Key Capabilities:**

- **PDF-to-Rules** — Converts free-text policies into structured, enforceable compliance rules
- **Explainable AI** — Every violation includes policy excerpt and data evidence
- **Human in the Loop** — Override false positives, approve violations, track decisions
- **Continuous Monitoring** — Track new and resolved violations over time
- **Audit-Ready Export** — Generate structured compliance reports instantly

**Why It Matters:** For startups preparing for GDPR, DPDP, or SOC2 compliance, PolicyGuard AI provides the automated bridge that never existed between what legal writes and what engineers build.

**Market Validation:** Research shows 70% of companies have severe data quality problems【14】. Bad data "will get you on the front page of WSJ and a call from a regulator"【36】. Existing tools focus on checklists, not policy-to-data enforcement. This solution directly addresses the governance issues practitioners highlight: policy enforcement, auditability, and remediation guidance.

---

## FAQ (ENGINEERING-FOCUSED)

### 1. What problem are we solving?

Compliance teams manually interpret PDF policies and inspect databases — a slow, error-prone, non-continuous process. There is no automated bridge between policy documents (PDFs) and database enforcement.

- **Current state issues:** Manual SQL checks, ad-hoc audits, no continuous monitoring
- **Why this matters:** Regulatory pressure increasing, SMEs lack dedicated compliance staff
- **What we're building:** Automated policy-to-data enforcement with explainability

### 2. What exactly does the user do?

**Flow 1 — First-Time Setup:**
1. User uploads policy PDF
2. System extracts rules
3. User connects database (or uploads CSV)
4. System scans database
5. Violations generated
6. Dashboard displays compliance score

**Flow 2 — Violation Investigation:**
1. User clicks violation
2. Sees rule description, policy excerpt, affected table/column, evidence
3. User marks as valid/false positive/adds note
4. Score updates

**Flow 3 — Monitoring:**
1. User clicks "Re-run Scan"
2. System compares with last scan
3. Shows new vs. resolved violations

**Flow 4 — Export:**
1. User clicks "Export Report"
2. System generates structured compliance report

### 3. Strategy OS (ARC) — Which intelligence layers does this strengthen?

**A — Ambition:** What intelligence gap are we closing?

We close the **Data Layer → Claim Layer → Belief Layer** intelligence gap:
- **Data Layer:** Extract facts from PDF policies
- **Claim Layer:** Convert to enforceable compliance claims
- **Belief Layer:** Enable users to trust and act on automated compliance assessment

**R — Risks:** What must be true for this to work? (Top 3 assumptions)

1. **Gemini API must accurately extract rules** — Prompt engineering must handle policy ambiguity. Risk: Misinterpretation → false violations. Mitigation: Manual rule editing, synthetic validation.
2. **Rule-to-column mapping must be reliable** — Semantic mapping between compliance rules and database columns. Risk: Incorrect mapping → false positives. Mitigation: Human review layer, override capability.
3. **Enforcement must be deterministic** — No vague LLM scoring. Risk: Inconsistent results. Mitigation: Structured rule schema, every decision logged.

**C — Choices:** What are we deliberately not doing?

- **NOT building live cron monitoring** — Simulated periodic scans only (MVP)
- **NOT building multi-policy simultaneous support** — Single policy at a time (MVP)
- **NOT building automated remediation** — Detection and reporting only (MVP)
- **NOT building role-based access control** — Single user context (MVP)

### 4. How does rule extraction work?

- PDF parsed via pdf-parse to extract raw text
- Text sent to Gemini API with structured prompt
- Gemini returns JSON array of rules with: rule_id, type, description, severity, conditions
- Rules stored in structured schema for enforcement engine

### 5. How does violation detection work?

- Database schema extracted (tables, columns, types)
- For each rule, enforcement engine checks relevant columns
- Deterministic matching: field_encrypted → check column metadata, consent_required → check column values
- Violation record created with: rule_id, table, column, evidence, severity, timestamp

### 6. How does explainability work?

Every violation includes:

- **Rule ID** — Reference to extracted rule
- **Policy excerpt** — Original text from PDF that generated the rule
- **Data evidence** — Actual value(s) that triggered violation
- **Risk severity** — High/Medium/Low
- **Why it violates** — Natural language explanation

No black-box answers. User can trace every violation back to policy text.

### 7. Why this solution? Market validation.

**Practitioner pain points from community research:**

- Schema-to-policy linking is manual and error-prone
- Risk scoring is binary (pass/fail) — no granular scores
- Tools flag issues but don't suggest fixes
- Audit logs are mandatory but rarely included
- GDPR "right to be forgotten" breaks default AI systems

**What existing tools miss:**
- Vanta, Drata: checklist compliance, not policy-to-data
- OneTrust, TrustArc: enterprise GRC, no direct database enforcement
- SQL linters: no policy understanding

**Our solution addresses all gaps:**
- End-to-end workflow (schema → policy mapping → risk → remediation)
- Numeric compliance scores per clause
- Concrete remediation suggestions ("encrypt column X")
- Full audit trail with human review
- Exportable audit report

---

## Non-Goals Summary

| Non-Goal | Reason |
| -------- | -------- |
| Live cron-based monitoring | Out of hackathon scope; simulated scans only |
| Multi-policy support (GDPR + HIPAA) | Single policy per scan |
| Automated remediation | Detection and reporting only |
| Role-based access control | Single user context |
| Real encryption validation | Schema-level check only |
| Data lineage integration | Out of scope |
| Slack/Email alerts | Out of scope |
| API integration with CI/CD | Out of scope |

---

## Success Definition

### What does success look like?

| Metric | Target |
|--------|--------|
| Rule extraction precision | >90% on test policies |
| Violation detection accuracy | >85% on synthetic test cases |
| Explainability coverage | 100% of violations have policy excerpt + evidence |
| Human review completion | 100% of violations can be overridden/approved |
| Scan performance | <5 seconds on sample dataset |
| False positive rate | <15% |

### What does failure look like?

- Rules not extracted from PDF (API failure)
- No violations detected when violations exist (false negatives)
- Violations with no explainability (black-box)
- Scan takes >30 seconds (performance failure)

---

## Timeline

| Milestone | Target Date |
| --------- | ----------- |
| MVP Complete | 24 hours (hackathon) |
| Post-MVP | After hackathon |

---

## Technical Implementation Notes

### Rule Schema (JSON)

```json
{
  "rule_id": "string",
  "type": "encryption | consent | retention | prohibited | format | access",
  "description": "string",
  "severity": "high | medium | low",
  "conditions": {
    "field": "string",
    "operator": "equals | contains | regex | exists",
    "value": "any"
  }
}
```

### Violation Schema (JSON)

```json
{
  "violation_id": "string",
  "rule_id": "string",
  "table": "string",
  "column": "string",
  "evidence": "any",
  "severity": "high | medium | low",
  "policy_excerpt": "string",
  "explanation": "string",
  "status": "open | resolved | false_positive",
  "reviewed_by": "string | null",
  "review_note": "string | null",
  "created_at": "timestamp",
  "resolved_at": "timestamp | null"
}
```

### API Endpoints (MVP)

- `POST /api/policies/ingest` — Upload PDF, extract rules
- `POST /api/connections/test` — Test database connection
- `POST /api/scan/run` — Run compliance scan
- `GET /api/violations` — List violations
- `PATCH /api/violations/:id` — Update violation status (review)
- `GET /api/compliance/score` — Get compliance score
- `GET /api/scan/history` — Get scan history with deltas
- `GET /api/export` — Export compliance report
