# Feature Doc: Yggdrasil

**Status:** v1 intent (authoritative)
**Mode:** N/A

---

## 1. One-sentence thesis

Yggdrasil is a system that turns unstructured compliance policies into executable database enforcement rules with continuous, explainable monitoring and human oversight.

---

## 2. Problem statement

- **What user problem exists?** Compliance teams manually interpret PDF policies and check databases — a slow, error-prone, non-continuous process with no automated bridge between policy documents and data stores.
- **Why does this matter specifically for this product?** This directly solves the hackathon challenge: accurate policy extraction, explainable violations, continuous enforcement, human oversight, and actionable insights.
- **Why is this not already solved elsewhere?** Existing compliance tools (Vanta, Drata) focus on checklist-based compliance, not direct policy-to-data enforcement. No product bridges PDF policies to database rules with explainability.

---

## 2.1 Market Context & Validation

### Practitioner Pain Points (Community Research)

Based on Reddit/HN practitioner research:

1. **Schema-to-Policy Linking** — No easy way to connect DB columns to regulations. Teams manually interpret policies and inspect data.
2. **Binary Risk Scoring** — Most tools only show pass/fail. Practitioners want granular risk scores per rule.
3. **No Remediation Guidance** — Tools flag issues but rarely suggest fixes ("encrypt column", "delete field").
4. **Audit Requirements** — Every decision must be logged. GDPR's "right to be forgotten" breaks default AI systems.
5. **Human-in-Loop** — Auditors want transparent logs and review interfaces.

### Why Existing Tools Fail

| Competitor | Gap |
|------------|-----|
| Vanta, Drata | Checklist compliance, no policy-to-data bridge |
| OneTrust, TrustArc | Enterprise GRC, no database enforcement |
| SQL linters | No policy understanding |

### Our Differentiator

- **End-to-end workflow**: Schema → Policy mapping → Risk scoring → Remediation
- **Numeric compliance scores** per clause
- **Concrete fixes** suggested ("Column `email` is PII; recommend pseudonymization")
- **Full audit trail** with human review
- **Exportable audit report**

### Market Statistics

- 70% of companies have severe data quality problems (BCG)
- GDPR violations: fines up to €20M or 4% of annual turnover
- "Bad data will get you on the front page of WSJ" (HN practitioner)

---

## 3. Target user mindset (MANDATORY)

- **Who is the user at the moment they encounter this feature?** A startup CTO or compliance officer preparing for GDPR/DPDP/SOC2 audit. They have policies drafted by legal in PDF format and a Postgres database they inherited.
- **What are they feeling?** Anxious, overwhelmed, uncertain where to start. They need quick visibility into risks and audit-ready evidence.
- **What would break trust?** Black-box AI that gives violations without explanation. False positives with no way to override. No way to track compliance over time.

---

## 4. Core philosophy

- **What belief does this feature encode?** Every compliance finding must be explainable and auditable. No black-box AI in compliance decisions.
- **How does it align with product mission?** Enable organizations to achieve continuous compliance through automation while maintaining human oversight.
- **What does this product refuse to do here?** Refuses to provide vague LLM scores without evidence. Refuses to skip human review. Refuses to log decisions without audit trail.

---

## 5. Behavioral contract

- **What can logged-out users do?** Sign up, login, view public demo
- **What can logged-in users do?** Upload PDFs, connect databases, view violations, review findings, export reports, re-run scans
- **What actions are gated?** Admin features (user management, billing), org-level settings
- **How does gating feel?** Seamless — users see upgrade prompts for premium features

---

## 5.1 SaaS Scalability Architecture (Post-MVP)

The MVP uses Supabase for storage. The architecture supports easy scaling later:

| Layer | MVP | Future SaaS |
|-------|-----|-------------|
| **Database** | Supabase (PostgreSQL) | PostgreSQL (Supabase) |
| **Storage** | Files discarded after processing | S3 for PDFs (optional) |
| **Auth** | Supabase Auth (REQUIRED) | Supabase Auth + orgs** | Auth |
| **APIenticated endpoints | API keys per org |
| **Hosting** | Vercel | Vercel Pro / AWS |

> **CRITICAL:** Auth is REQUIRED for MVP. All API endpoints require Supabase authentication.

### Architecture for Scale (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                     Yggdrasil Platform                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Web App   │  │   Mobile    │  │      API            │ │
│  │  (Next.js)  │  │   (React)   │  │   (REST/GraphQL)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Supabase (PostgreSQL - Future)            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Scalability Principles (Already in Design)

1. **API-First Design** — All features accessible via REST API
2. **Stateless Services** — Frontend stateless; state in database
3. **Separation of Concerns** — Services modular and swappable
4. **Extensibility Points** — Adapters for more databases, LLM providers

### Future-Ready Data Model

The data model is designed to easily migrate to PostgreSQL later:

```sql
-- Future: Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free'
);

-- Future: Users belong to organizations  
CREATE TABLE users (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member'
);
```

### Extensibility Points

| Extension | Implementation |
|-----------|-----------------|
| More databases | Adapter pattern for MySQL, MongoDB, Snowflake |
| More AI models | Abstract LLM interface (Claude, GPT, Llama) |
| Webhooks | Event webhooks for violations, scans |
| Custom rules | User-defined rule templates |
| Integrations | Jira, Slack, PagerDuty webhooks |

---

## 6. Scope boundaries

### Included

- PDF policy ingestion with text extraction
- Structured rule extraction via Gemini API
- Supabase Postgres connection
- CSV upload alternative
- Deterministic rule enforcement engine
- Explainable violations (policy excerpt + data evidence)
- Human review layer (override, approve, add notes)
- Compliance dashboard (score, breakdown, violation table)
- Simulated periodic monitoring with delta
- JSON export / downloadable report

### Deferred (SaaS Roadmap)

These features are deferred to post-hackathon but designed for in the architecture:

| Feature | SaaS Phase | Priority |
|---------|------------|----------|
| Multi-tenant organizations | Phase 1 | High |
| Role-based access control | Phase 1 | High |
| Live cron-based monitoring | Phase 1 | Medium |
| Multi-policy support | Phase 2 | Medium |
| Slack/Email alerts | Phase 2 | Medium |
| Real encryption validation | Phase 2 | Low |
| Data lineage integration | Phase 3 | Low |
| API integration with CI/CD | Phase 3 | Low |
| Automated remediation actions | Phase 3 | Low |
| Policy diff detection | Phase 3 | Low |

## 6. Scope boundaries

### MVP Scope (Hackathon) — Winning Stack

**Stack:** Next.js + Supabase (Auth + Database) + Vercel

Based on 2026 hackathon trends, this stack wins because:
- Supabase provides auth + DB in one setup (fastest to MVP)
- Next.js provides SSR, routing, API routes
- Vercel deploys automatically on GitHub push
- shadcn/ui for polished UI quickly

| Component | MVP Choice | Why |
|-----------|------------|-------|
| **Frontend + Backend** | Next.js 14 (App Router) | Single repo, Vercel deploys auto |
| **Auth + Database** | Supabase | Auth + PostgreSQL + RLS in one |
| **AI** | Gemini API with Vercel AI SDK | Structured output with Zod validation |
| **PDF** | unjs/unpdf | Serverless-compatible, works on Vercel |
| **CSV Parsing** | Papa Parse | Browser + Node.js support |
| **UI** | shadcn/ui + Tailwind | Polished UI fast |
| **Charts** | Recharts (shadcn/ui) | Native integration |
| **Schema Validation** | Zod | TypeScript-first validation |

**Deployment:** Push to GitHub → Vercel auto-deploys

### MVP Features

- PDF policy ingestion with text extraction (unjs/unpdf)
- Structured rule extraction via Gemini API with system prompts
- CSV/JSON/Airtable upload (Papa Parse)
- Deterministic rule enforcement engine
- Explainable violations (policy excerpt + data evidence)
- Human review layer (override, approve, add notes)
- Clarification questions for ambiguous policies
- Compliance dashboard (score, breakdown, violation table)
- Manual rescan with diff detection (no redundant scans)
- JSON export / downloadable report

### Data Storage Philosophy

**Files are discarded after processing** — This is a deliberate design choice:
- Uploaded PDFs, CSVs, JSONs are processed and then discarded
- Only extracted rules and violation data are stored in Supabase
- This reduces audit surface area and data privacy concerns
- Users re-upload files for each scan (no file storage needed)

### Future Roadmap (SaaS Phases)

| Feature | SaaS Phase | Priority |
|---------|------------|----------|
| Multi-tenant organizations | Phase 1 | High |
| Role-based access control | Phase 1 | High |
| Live cron-based monitoring | Phase 1 | Medium |
| Multi-policy support | Phase 2 | Medium |
| Slack/Email alerts | Phase 2 | Medium |
| Real encryption validation | Phase 2 | Low |
| Data lineage integration | Phase 3 | Low |
| API integration with CI/CD | Phase 3 | Low |
| Automated remediation actions | Phase 3 | Low |
| Policy diff detection | Phase 3 | Low |

### Intentionally undefined

- Maximum PDF size
- Maximum database size
- Concurrent scan handling
- Policy versioning strategy

---

## 7. Non-goals (MANDATORY)

| Non-goal | Reason |
| -------- | -------- |
| Live cron monitoring | Out of hackathon scope; simulated periodic scans only |
| Multi-policy support | Single policy at a time to ensure accuracy |
| Automated remediation | Detection and reporting only; no auto-fix |
| Role-based access control | Single user context for MVP |
| Real-time encryption validation | Schema-level checks only |
| Data lineage integration | Out of scope for MVP |
| Slack/Email alerts | Out of scope for MVP |
| CI/CD API integration | Out of scope for MVP |

---

## 8. UX OS (MOMENTS) — How users move & decide

**M — Moment:** What exact moment is this feature for?

- **Initial assessment moment:** User first wants to understand their compliance posture
- **Investigation moment:** User examining specific violations
- **Monitoring moment:** User checking for changes over time
- **Reporting moment:** User preparing for audit

**O — Objective:** What is the user trying to decide or understand?

- **Decision:** Is my database compliant with my policy?
- **Understanding:** Which violations are critical? Which are false positives?
- **Discovery:** What changed since last scan?

**M — Mental Model:** What does the user think is happening?

- Users expect PDF upload → immediate results
- Users expect violations to link back to policy text
- Users expect to override false positives
- Users expect to see compliance score change after review

**E — Effort:** What friction exists today?

- **High friction removed:** Manual SQL queries, policy interpretation
- **Cognitive load reduced:** Automated rule extraction, explainable output
- **Steps to value:** Upload PDF → Connect DB → View results (3 steps)

**N — Next Best Action:** What should feel obvious next?

- **Primary:** View violations after scan completes
- **Secondary:** Click violation to investigate
- **Tertiary:** Export report after review

**T — Trust Signal:** What reassures the user they're right?

- **Policy excerpt** shown with every violation
- **Data evidence** displayed (actual values)
- **Human review** allows override
- **Audit trail** logs every decision

**S — State Awareness:** How does the system communicate status?

- **Loading:** Progress indicator during PDF parsing, rule extraction, scan
- **Empty:** No violations = success state with celebration
- **Success:** Scan complete, violations displayed, score calculated
- **Error:** Connection failed, extraction failed — clear error messages with retry
- **Stale:** "Last scanned X ago" indicator, re-scan prompt

---

## 9. UI OS (CLEAR GRID) — How information is structured

**C — Content Hierarchy:**

- **Primary:** Compliance score (large, prominent), violation count
- **Secondary:** Violation table with severity, rule type, table/column
- **Supporting:** Policy excerpt, data evidence (in violation detail)
- **Optional:** Scan history, export button

**L — Layout Rhythm:**

- **Dashboard:** Score card → Rule breakdown → Violation table
- **Detail:** Violation card with expandable sections
- **Responsive:** Single column on mobile, multi-column on desktop

**E — Emphasis Rules:**

- **Compliance score:** Large number, color-coded (green/yellow/red)
- **High severity violations:** Red accent, top of list
- **Action buttons:** Primary = Run Scan, Secondary = Export

**A — Affordance & Mapping:**

- Upload zone clearly indicated with dashed border + icon
- Connect button enables on valid credentials
- Violation row clickable → detail drawer
- Scan button shows loading state during execution

**R — Reusability:**

- **Card component:** Score card, rule summary card
- **Table component:** Violation table, scan history table
- **Button component:** Primary, secondary, destructive variants
- **Badge component:** Severity tags (high/medium/low)
- **Dialog/Drawer:** Violation detail, review form

**Required UI States:**

- **loading:** Skeleton screens for dashboard, spinner for scan
- **empty:** "No violations found" with success indicator
- **success:** Scan complete, violations displayed
- **error:** Connection failed, extraction failed — retry button
- **stale:** "Last scanned X ago" with re-scan CTA

---

## 10. Interaction OS (TRFL+E) — How actions feel

**T — Trigger:** User or system?

- **User triggers:** Upload PDF, connect database, run scan, review violation, export report
- **System triggers:** Scan completion, score recalculation on review

**R — Rules:** Constraints, logic, time bounds

- **PDF:** Must be valid PDF, extractable text
- **Connection:** Valid Supabase credentials OR CSV file
- **Scan:** Must have rules extracted AND database connected
- **Review:** Status change logged with timestamp and user note

**F — Feedback:** Visual, textual, haptic

- **Visual:** Loading spinner, progress bar, score color change
- **Textual:** "Scanning X tables...", "Found Y violations"
- **No haptic:** Web application

**L — Loops & Modes:** What changes over time or repetition?

- **Review loop:** Violation → Review → Status update → Score recalculate
- **Monitoring loop:** Initial scan → Re-scan → Delta shown (new/resolved)
- **Modes:** View mode, Review mode, Export mode

**E — Ethics Check:** Does this increase clarity without manipulation?

- **Does this increase engagement but reduce trust?** No — each violation is evidence-backed
- **Does this increase clarity without manipulation?** Yes — policy excerpt + data evidence + explanation
- **Are incentives transparent?** Yes — compliance score based on review decisions, not hidden factors

---

## 11. Success metrics + guardrails (Measurement OS — SIGNAL)

**S — Signal Strengthened:** Which intelligence layer improves?

- **Data Layer:** Extracts structured facts from PDF policies
- **Claim Layer:** Converts to enforceable compliance claims
- **Belief Layer:** Enables trust through explainability

**I — Impact Over Time:** What compounds? What decays?

- **Compounds:** More policies processed = better extraction model
- **Decays:** Stale scan results — user prompted to re-scan

**G — Guardrails:** What noise are we explicitly suppressing?

- **No vague scoring:** Every violation has evidence
- **No black-box:** Policy excerpt + data evidence required
- **No unreviewed:** All violations can be overridden
- **False positive rate:** Monitored, target <15%

**N — Narrative Effect:** How does this change understanding?

- Users understand exactly why each violation exists
- Users can trace violation → policy text
- Users see compliance as measurable, not abstract

**A — Adoption Quality:** Who benefits most?

- **SME compliance officers** with limited automation
- **Startup CTOs** preparing for first audit
- **Data engineers** responsible for compliance checks

**L — Learnings Loop:** How do insights feed back?

- Review decisions inform false positive rate
- Extraction failures inform prompt engineering
- Scan performance informs optimization priorities

### Traditional Metrics

**What success looks like:**

| Metric | Target |
|--------|--------|
| Rule extraction precision | >90% |
| Violation detection accuracy | >85% |
| Explainability coverage | 100% |
| Scan performance | <5 seconds |
| False positive rate | <15% |

**What failure looks like:**

- Rules not extracted (API failure)
- No violations on non-compliant database (false negatives)
- Violations without explanation (black-box)
- Scan timeout (>30 seconds)

**Negative metrics to watch:**

- Unreviewed violation count
- False positive rate increase
- Scan time degradation with larger DB

---

## 12. Engineering notes (lightweight)

**Allowed:**

- **Routing:** `/dashboard`, `/scan`, `/violations/:id`, `/export`
- **Event naming:** `scan_started`, `scan_completed`, `violation_reviewed`, `export_downloaded`
- **Gating:** None in MVP (single user)

**Not allowed:**

- Component specs (use shadcn/ui)
- Framework mandates (use Next.js + React)
- Pixel descriptions

---

## 13. Open questions

| Question | Status | Notes |
| -------- | ------ | ----- |
| How to handle ambiguous policy language? | Open | May require manual rule editing |
| What is violation confidence threshold? | Open | Default to include all, let human filter |
| How to version policies when updated? | Open | Not in MVP scope |
| Maximum PDF size limit? | Open | Default 10MB, tune as needed |
| Maximum database table count? | Open | Handle up to 100 tables |

---

## Integration Points

### Related Features

- **PDF Ingestion** → Rule Extraction: Input → Output
- **Rule Extraction** → Enforcement Engine: Rules → Violations
- **Enforcement Engine** → Dashboard: Violations → Score
- **Dashboard** → Human Review: Violations → Reviewed Violations
- **Human Review** → Monitoring: Reviews → Delta

### Technical Dependencies

- Gemini API (rule extraction, column mapping)
- Supabase (Postgres database)
- pdf-parse (PDF text extraction)
- Next.js + React (frontend)
- Node.js + Express (backend)
- shadcn/ui (components + charts)
- Lucide (icons)

---

## Database Schema

### policies

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Policy name |
| pdf_url | TEXT | Stored PDF path |
| rules | JSONB | Extracted rules array |
| created_at | TIMESTAMP | Upload time |
| updated_at | TIMESTAMP | Last update |

### connections

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| type | TEXT | 'supabase' or 'csv' |
| config | JSONB | Connection config |
| created_at | TIMESTAMP | Connection time |

### violations

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scan_id | UUID | Reference to scan |
| rule_id | TEXT | Reference to rule |
| table | TEXT | Database table |
| column | TEXT | Database column |
| evidence | JSONB | Triggering values |
| severity | TEXT | high/medium/low |
| policy_excerpt | TEXT | Source text |
| explanation | TEXT | Why it violates |
| status | TEXT | open/resolved/false_positive |
| reviewed_by | TEXT | Reviewer (null if not reviewed) |
| review_note | TEXT | Reviewer note |
| created_at | TIMESTAMP | Detection time |
| resolved_at | TIMESTAMP | Resolution time |

### scans

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| policy_id | UUID | Reference to policy |
| connection_id | UUID | Reference to connection |
| score | FLOAT | Compliance score |
| violation_count | INT | Total violations |
| status | TEXT | completed/failed |
| created_at | TIMESTAMP | Scan time |
