# Feature Brief: Yggdrasil

> **⚠️ DEPRECATED:** This document's content has been merged into [Feature-Yggdrasil.md](./Feature-Yggdrasil.md). Please refer to that document for the latest specifications.
> 
> **Reason:** Duplicate content. Core information preserved in Feature doc.

**Feature Name:** Yggdrasil — Autonomous Policy-to-Data Compliance Engine
**Status:** Draft
**Version:** v1
**Created:** 2026-02-21

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [UserStories-Yggdrasil.md](./UserStories-Yggdrasil.md)
- [PRFAQ-Yggdrasil.md](./PRFAQ-Yggdrasil.md)
- [Integrations.md](./Integrations.md)

---

## 1. Problem Statement

### The Problem

Compliance teams manually bridge the gap between policy documents (PDFs) and database enforcement. They interpret policy text, inspect schemas, run SQL checks, and prepare audit reports. This process is:

- **Slow** — Manual interpretation takes hours
- **Error-prone** — Human interpretation leads to inconsistencies
- **Non-continuous** — Point-in-time checks, not ongoing monitoring

### Current State

Policies exist as free-text PDF documents. Data lives in databases (Postgres/Supabase). There is no automated bridge between them. Compliance teams perform ad-hoc, manual checks that are not scalable or continuous.

### Why Now

- Regulatory pressure increasing (GDPR, DPDP, SOC2)
- Startups/SMEs lack dedicated compliance teams
- Hackathon challenge presents clear technical path forward with LLM capabilities

---

## 2. Target Users

### Primary User

**Compliance Officers in SMEs, Data Governance Teams, Startup CTOs**

- Preparing for GDPR, DPDP, or SOC2 audits
- Have policies drafted by legal
- Have a Postgres database or CSV datasets
- Need quick visibility into compliance risks
- Need audit-ready evidence

### User Mindset

The user is **anxious and overwhelmed**. They have:

- A pile of PDF policies they've never read
- A database they inherited
- An upcoming audit with no automated way to prove compliance

**What would break trust:** Black-box AI that gives violations without explanation. False positives without recourse. No way to track compliance over time.

---

## 3. Proposed Solution

### Core Concept

Yggdrasil converts free-text PDF policy documents into structured, enforceable compliance rules, connects to company databases, automatically detects violations with explainable justifications, and provides human review capabilities with ongoing monitoring.

### How It Works

1. User uploads PDF policy document
2. System extracts text and converts to structured compliance rules (JSON schema)
3. User connects Supabase Postgres OR uploads CSV dataset
4. System scans database against rules
5. Violations generated with full explainability
6. Dashboard displays compliance score with breakdown

### Key Behaviors

- **PDF Ingestion** — Extract text from PDFs, convert to structured rules
- **Rule Extraction** — Identify enforceable rule types: encryption, consent, retention, prohibited storage, format validation, access restrictions
- **Database Connection** — Connect to Supabase Postgres OR upload CSV
- **Violation Detection** — Match rules against schema, generate structured reports
- **Explainability** — Each violation includes rule ID, policy excerpt, data evidence, risk severity, justification
- **Human Review** — Override false positives, approve violations, add notes, recalculate score
- **Monitoring** — Store scan results, re-run, show delta (new/resolved violations)
- **Export** — JSON export, downloadable compliance report

---

## 4. Value Proposition

### For Users

- **Speed** — Minutes instead of days to assess compliance
- **Accuracy** — Consistent rule application vs. manual interpretation
- **Confidence** — Explainable violations with evidence
- **Continuous** — Ongoing monitoring with delta tracking
- **Audit-ready** — Structured export for auditors

### For Business

- **Reduces manual compliance effort** by 80%+
- **Enables continuous enforcement** vs. point-in-time checks
- **Provides evidence trail** for audits
- **Scales with database growth**

### Differentiation

- **Explainable AI** — No black-box scoring; every violation has policy excerpt + data evidence
- **Human in the loop** — Override false positives, approve violations, track decisions
- **Policy-to-data bridge** — First product that directly connects PDF policies to database enforcement

---

## 5. Success Metrics

### Primary Metrics

- Accurate rule extraction from PDF (target: >90% precision on rule identification)
- Correct violation detection (target: >85% accuracy on synthetic test cases)
- Clear explainability (100% of violations include policy excerpt + data evidence)
- Human review functioning (100% of violations can be overridden/approved)
- Monitoring delta working (new vs. resolved violations tracked)

### Guardrails

- No vague LLM scoring — enforcement must be deterministic
- Every decision logged for auditability
- False positive rate monitored (target: <15%)

---

## 6. Timeline & Phasing

### Phase 1: MVP (Hackathon Scope)

**What's included:**
- PDF Policy Ingestion
- Structured Rule Extraction
- Database/CSV Connection
- Rule Enforcement Engine
- Explainable Violations
- Human Review Layer
- Compliance Dashboard
- Periodic Monitoring (Simulated)
- Audit-Ready Export

**Timeline:** 24 hours (hackathon)

### Phase 2: Post-Hackathon

**What's deferred:**
- Live cron-based monitoring
- Slack/Email alerts
- Real encryption validation
- Data lineage integration
- Multi-policy support (GDPR + HIPAA + DPDP)
- Role-based access control
- API integration with CI/CD pipelines
- Automated remediation actions
- Policy diff detection

---

## 7. Dependencies

### Technical Dependencies

- **Next.js** — Full-stack (frontend + API routes), deploys to Vercel
- **Supabase** — Auth + PostgreSQL database + Row Level Security
- **Gemini API** — Rule extraction
- **pdf-parse** — PDF text extraction
- **Papa Parse** — CSV parsing

### Product Dependencies

- shadcn/ui components
- Lucide icons

### External Dependencies

- Gemini API key
- Supabase project (free tier works)
- GitHub + Vercel accounts

---

## 8. Risks & Mitigation

### Risk 1: Gemini extraction accuracy

**Description:** LLM may misinterpret policy text or miss nuanced rules
**Mitigation:** Prompt engineering, validate with synthetic test cases, allow manual rule editing

### Risk 2: False positives

**Description:** Rule-to-column mapping may be incorrect, leading to invalid violations
**Mitigation:** Human review layer, override capability, false positive rate metric

### Risk 3: Database schema complexity

**Description:** Complex schemas may not map cleanly to rules
**Mitigation:** Semantic column mapping via Gemini, manual override capability

---

## 9. Competitors & References

### Competitors

- **Vanta, Drata** — Compliance automation but not policy-to-data focused
- **OneTrust, TrustArc** — Enterprise GRC, no direct database enforcement
- **Open-source SQL linters** — No policy understanding

### References

- Gemini function calling documentation
- Supabase documentation
- PDF parsing libraries (pdf-parse)

---

## 10. Market Research & Community Insights

### Practitioner Pain Points (Reddit/HN Research)

Based on practitioner forum research, real compliance teams face these challenges:

- **Schema-to-Policy Linking:** No easy way to connect DB columns to specific regulations. Teams still manually interpret policies and inspect data【24】【36】.
- **Risk Scoring:** Compliance status is often binary (pass/fail). Few tools compute a **granular risk score** showing which rules are most at risk.
- **Remediation Guidance:** Even if an issue is found, tools usually stop there; they rarely suggest concrete fixes (e.g. "encrypt column", "delete redundant field")【24】.
- **Human-in-Loop Audit:** Auditors want transparent logs. Few demos show a review interface where a human approves or tweaks AI findings【24】【147-L154】.
- **Audit Requirements:** Every data access and decision must be logged in detail. GDPR's "right to be forgotten" "basically breaks how most AI systems work by default" — data must be purged everywhere (database, embeddings, cache)【24】【126-L134】.

### What Current Tools Miss

Existing compliance tools (Vanta, Drata, OneTrust):
- Focus on checklist-based compliance, not direct policy-to-data enforcement
- Don't bridge PDF policies to database rules
- Lack explainability — black-box scoring
- No remediation suggestions
- No granular risk scoring

### Our Differentiator

A **Data Policy Compliance** solution that:
1. **Automatically ingests** a dataset/schema and a policy spec (GDPR/DPDP rules)
2. **Classifies each field** (ID, email, PII, etc.)
3. **Highlights which policy clauses apply** to each column
4. **Computes a numeric compliance score** per clause
5. **Suggests concrete fixes** — not just flag issues ("Column `email` is PII; recommend pseudonymization")
6. **Includes interactive review** with full audit logs
7. **Exports audit-ready report**

This end-to-end workflow is what practitioners desperately need. It goes beyond simple LLM marking — it enforces policy documents with expert verification.

### Key Statistics

- **70% of companies have severe data quality problems**【14】【179-L182】
- GDPR violations can result in fines up to €20M or 4% of annual turnover
- Bad data "will get you on the front page of WSJ and a call from a regulator"【36】【123-L125】

---

## 11. Open Questions

- How to handle ambiguous policy language that requires legal interpretation?
- What is the threshold for violation confidence before alerting?
- How to version policies when updated?

---

## 11. Approval

| Role        | Name | Date | Status |
| ----------- | ---- | ---- | ------ |
| Product     |      |      |        |
| Engineering |      |      |        |
| Design      |      |      |        |

---

## Appendix: Research Sources

- 【24】【126-L134】Reddit/HN: GDPR "right to be forgotten" breaks AI systems
- 【24】【134-L139】Reddit/HN: Consent management requirements
- 【24】【147-L154】Reddit/HN: Audit log requirements
- 【36】【88-L97】HN: Automated lineage, quality, integrity checks
- 【36】【123-L125】HN: "Bad data will get you on front page of WSJ"
- 【14】【179-L182】BCG: 70% of companies have severe data quality problems
