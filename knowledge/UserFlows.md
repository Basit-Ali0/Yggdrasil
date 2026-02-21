# User Flow Stories: Yggdrasil

**Project:** Yggdrasil — Autonomous Policy-to-Data Compliance Engine  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [UserStories-Yggdrasil.md](./UserStories-Yggdrasil.md) - All user stories with acceptance criteria
- [WorkSplit-Yggdrasil.md](./WorkSplit-Yggdrasil.md) - Implementation timeline

---

## Overview

These detailed user flow stories map the complete journey through Yggdrasil for two distinct user personas:

1. **Alex (Developer)** - Technical user who wants to integrate compliance checking into their workflow
2. **Sarah (CEO of Growth-Stage Startup)** - Executive who needs compliance for investor readiness and team management

Each story includes:
- Step-by-step actions
- App responses
- User thoughts and feelings
- Success/failure metrics

---

# Story 1: Alex the Developer

## Persona

**Name:** Alex Chen  
**Role:** Full-stack Developer  
**Company:** DataFlow Inc (15 employees)  
**Tech Savvy:** High  
**Goals:** Automate compliance, integrate into CI/CD, reduce manual work  
**Pain Points:** Manual compliance checks take 2 days per quarter, no visibility between scans

---

## User Flow: Developer Completing First Scan

### Phase 1: Onboarding & Setup

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 1.1 | Navigate to app | Landing page loads with clear value prop: "Automated compliance scanning in minutes" | "This looks promising, let me try it" |
| 1.2 | Click "Get Started" | Prompts for basic info or skip to dashboard | "I'll skip for now, want to see the product" |
| 1.3 | View empty dashboard | Shows welcome message + "Connect your first data source" CTA | "Clean interface, easy to understand" |
| 1.4 | Click data source options | Shows options: CSV, JSON, Airtable, Supabase | "I have my data in a CSV, perfect" |

**Success Metrics:**
- Time to first dashboard: <5 seconds
- Clear navigation: 100%

---

### Phase 2: Data Upload

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 2.1 | Select "Upload CSV" | Opens file picker + drag-drop zone | "Simple upload interface" |
| 2.2 | Drag users.csv (5000 rows) | Shows upload progress bar | "Good progress indicator" |
| 2.3 | Upload completes | Shows "Parsed 5000 records, 12 columns detected" | "Fast! Under 2 seconds" |
| 2.4 | Display schema preview | Table showing columns: id, email, name, phone, address, created_at, etc. | "I can see my data structure - looks correct" |

**App Response - Schema Preview:**
```
┌────────────┬─────────────┬──────────┐
│ Column     │ Type        │ Sample   │
├────────────┼─────────────┼──────────┤
│ id         │ number      │ 1        │
│ email      │ string      │ a@b.com  │
│ name       │ string      │ John     │
│ phone      │ string      │ 555-1234 │
│ created_at │ timestamp   │ 2024-... │
└────────────┴─────────────┴──────────┘
```

**Error Handling:**
- Invalid CSV → "Error on line 42: malformed data" with line preview
- Empty file → "CSV file is empty, please upload valid data"

**Success Metrics:**
- CSV parse time: <2 seconds for 10MB
- Schema accuracy: 100%

---

### Phase 3: Policy Selection

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 3.1 | Click "Select Policy" | Shows: "Upload PDF" OR "Choose Pre-built" | "Let me try pre-built first" |
| 3.2 | Click "GDPR" | Shows policy details: 10 rules, description | "Exactly what I need for Europe" |
| 3.3 | Click "SOC2" | Shows policy details: 12 rules | "Good to have both options" |
| 3.4 | Select GDPR | Shows extracted rules list | "I can see exactly what will be checked" |

**App Response - Rules Display:**
```
✓ GDPR Compliance Pack (10 rules)
  ├─ GDPR-001: Retention period
  ├─ GDPR-002: Consent status  
  ├─ GDPR-003: Encrypted PII
  ├─ GDPR-004: Special category data
  └─ ...6 more rules
```

**Success Metrics:**
- Policy selection: <1 second
- Rules display: <500ms

---

### Phase 4: Running Scan

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 4.1 | Click "Run Scan" | Shows progress: "Analyzing 5000 records..." | "Let's see what it finds" |
| 4.2 | Scan completes (3.2s) | Shows: "Scan complete! Found 5 violations" | "Pretty fast" |
| 4.3 | View violations list | Table with severity badges | "I can see what's wrong" |

**App Response - Violations Table:**
```
┌────────┬─────────────┬──────────┬────────────┬──────────────────┐
│ Severity│ Rule        │ Column   │ Records    │ Status           │
├────────┼─────────────┼──────────┼────────────┼──────────────────┤
│ 🔴 High│ GDPR-003    │ email    │ 4,200      │ Open             │
│ 🔴 High│ GDPR-003    │ phone    │ 3,100      │ Open             │
│ 🟡 Med │ GDPR-002    │ consent  │ 500        │ Open             │
│ 🟢 Low │ GDPR-009    │ -        │ -          │ Needs Review     │
└────────┴─────────────┴──────────┴────────────┴──────────────────┘
```

**Success Metrics:**
- Scan time: <5 seconds
- Violation accuracy: >85%

---

### Phase 5: Review & Remediation

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 5.1 | Click first violation | Detail drawer opens | "Need to understand this" |
| 5.2 | View details | Shows: rule, policy excerpt, evidence, remediation | "Clear explanation" |

**App Response - Violation Detail:**
```
┌─────────────────────────────────────────────────┐
│ GDPR-003: Unencrypted PII                       │
├─────────────────────────────────────────────────┤
│ Severity: 🔴 High                              │
│ Policy: "Personal data must be encrypted..."   │
│ Evidence: 4,200 unencrypted emails found       │
│ Table: users | Column: email                   │
├─────────────────────────────────────────────────┤
│ 💡 Remediation                                 │
│ Enable encryption at rest for 'email' column   │
│ Use Supabase pgcrypto for column-level encrypt │
└─────────────────────────────────────────────────┘
```

| 5.3 | Click "Mark as Valid" | Toast: "Violation confirmed" + score updates | "This is valid, needs fixing" |
| 5.4 | Repeat for other violations | Each updates score in real-time | "I can track impact of my reviews" |

**Success Metrics:**
- Remediation shown: 100% of violations
- Review time per violation: <30 seconds

---

### Phase 6: Generate Report

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 6.1 | Click "Export" | Shows options: PDF, JSON, Share Link | "Need to share with team" |
| 6.2 | Click "PDF Report" | Generates branded PDF | "Professional looking" |
| 6.3 | Download completes | File: Yggdrasil_Report_DataFlow_2026-02-21.pdf | "Ready to share" |

**Success Metrics:**
- PDF generation: <3 seconds

---

### Phase 7: Continuous Monitoring

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 7.1 | Return next week | Upload updated CSV | "New users since last scan" |
| 7.2 | Click "Rescan" | Shows: "Comparing to previous scan..." | "Want to see changes" |
| 7.3 | View delta | Shows: "3 new, 2 resolved" | "Our fixes worked!" |

**App Response - Delta Display:**
```
📊 Scan Results
├─ Previous Score: 72%
├─ Current Score: 81%
├─ ↑ Improved 9 points
├─ New Violations: 3
└─ Resolved: 2
```

---

## Developer Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Time to first scan | <10 min | ~5 min |
| Scan time | <5 seconds | 3.2 seconds |
| Report generation | <3 seconds | 2.1 seconds |
| Remediation clarity | 100% | 100% |
| Would recommend | - | Yes |

---

# Story 2: Sarah the CEO

## Persona

**Name:** Sarah Martinez  
**Role:** CEO  
**Company:** TechStart (45 employees, Series A)  
**Tech Savvy:** Medium  
**Goals:** Get SOC2 certified, impress investors, give engineering team focus  
**Pain Points:** Don't understand technical details, need to report to board, no time for manual processes

---

## User Flow: CEO Completing First Scan

### Phase 1: Onboarding

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 1.1 | Navigate to app | Landing page: "Automate compliance in minutes" | "Finally, something that doesn't require technical setup" |
| 1.2 | Click "Get Started" | Brief onboarding: "What are you compliance for?" | "I know exactly what I need - SOC2" |
| 1.3 | Select "SOC2" | Dashboard with SOC2 template pre-loaded | "Perfect, they know what I need" |
| 1.4 | View empty state | Shows: "Connect your data to start" | "Simple, what's next?" |

**User Thoughts:** "This is designed for business people, not engineers. That's exactly what I need."

---

### Phase 2: Data Connection (with Team Help)

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 2.1 | Click "Connect Database" | Shows options with difficulty indicators | "I'll ask my CTO to help with this" |
| 2.2 | Have Alex (CTO) connect Supabase | Connection validated in <5 seconds | "That was fast" |
| 2.3 | View schema | Simple table view with friendly names | "I can see our data without technical jargon" |

**User Thoughts:** "Even I can understand what data we have. Good."

---

### Phase 3: Policy Review

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 3.1 | View pre-loaded SOC2 policy | Shows: "12 compliance rules" | "This covers what investors care about" |
| 3.2 | Click to expand rule | Plain English explanation | "Now I understand what this means" |

**App Response - Plain English Rules:**
```
SOC2 Compliance (12 rules)
├── Who can access your data (3 rules)
│   └── Only authorized people can see customer data
├── Is your data protected (4 rules)
│   └── Customer information is encrypted
├── Are you tracking changes (3 rules)
│   └── Every action is logged for auditors
└── How long do you keep data (2 rules)
    └── Old data is automatically cleaned up
```

**User Thoughts:** "This is actually making sense. I can explain this to my board."

---

### Phase 4: Running Scan & Understanding Results

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 4.1 | Click "Scan Now" | Progress with friendly messages: "Analyzing your data..." | "This is exciting" |
| 4.2 | Scan complete | Big number: "72% Compliant" with color (Yellow) | "72% - that's not great, but I know where I stand" |

**App Response - Dashboard:**
```
┌────────────────────────────────────────┐
│  SOC2 Compliance Score                 │
│                                        │
│           72% ⚠️                       │
│         Yellow Zone                   │
│                                        │
│  🔴 Critical: 2    🟡 Warning: 5       │
│  🟢 Passed: 5                          │
└────────────────────────────────────────┘
```

| 4.3 | Click "View Issues" | Priority list of what to fix | "Now I know what to tell the team" |

**User Thoughts:** "Finally, I have something concrete to work with."

---

### Phase 5: Sharing with Team

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 5.1 | Click "Share Report" | Options: PDF, Link, Summary | "Need to send to my engineering lead" |
| 5.2 | Click "Copy Summary" | Formatted text copied | "Perfect for Slack" |

**Copied Summary:**
```
📊 TechStart SOC2 Compliance Report
Score: 72% ⚠️
Critical: 2 | Warnings: 5 | Passed: 5

Top Actions:
1. Enable encryption on customer_emails table
2. Set up audit logging for user_permissions

Generated by Yggdrasil
```

| 5.3 | Send to Slack #engineering | Team sees clear actions | "Now the team knows exactly what to do" |

**User Thoughts:** "This is exactly how I wanted to communicate compliance to my team."

---

### Phase 6: Following Up

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 6.1 | 2 weeks later, return to app | Dashboard shows last scan + new prompt | "Have we fixed those issues?" |
| 6.2 | Click "Quick Rescan" | "Comparing to previous scan..." | "Faster this time" |
| 6.3 | View improvement | "Score: 72% → 85% | "We made progress!" |

**App Response - Progress:**
```
Great progress! 
Your compliance improved by 13 points

✓ 2 Critical issues resolved
✓ 3 Warnings addressed
New: 1 Warning added
```

**User Thoughts:** "This is exactly what I needed to show investors. We have a compliance roadmap."

---

### Phase 7: Board Presentation

| Step | Action | App Response | User Thoughts/Feelings |
|------|--------|--------------|------------------------|
| 7.1 | Click "Export PDF" | Professional branded document | "This looks like it came from a big company" |
| 7.2 | Download PDF | Includes: cover, summary, issues, timeline | "I can present this directly" |

**PDF Sections:**
1. Cover: TechStart Logo + "SOC2 Compliance Assessment"
2. Executive Summary: "85% compliant, improving"
3. Key Findings: Top 3 issues with remediation
4. Timeline: Progress over last 30 days

**User Thoughts:** "This is board-ready. Investors will be impressed."

---

## CEO Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Understandable without tech help | 100% | Yes |
| Time to first report | <15 min | ~12 min |
| Board-ready output | Yes | Yes |
| Would recommend | - | Definitely |

---

## Cross-Cutting Insights

### What Both Users Loved

1. **Speed** - "Done in seconds, not days"
2. **Clarity** - "I know exactly what to fix"
3. **Actionability** - "Remediation steps are clear"
4. **Shareability** - "Can communicate to anyone"

### Gaps Identified

| Gap | User Story | Priority |
|-----|------------|----------|
| Want historical trend chart | Alex, Sarah | P0 - Added US-14b |
| Need to update data easily | Alex | P0 - Added US-14c |
| Need issue tracking list | Sarah | P0 - Added US-17b |
| Need professional PDF | Sarah | P0 - Added US-17c |
| Need shareable links | Sarah | P0 - Added US-17d |
| Need quick summary for Slack | Sarah | P0 - Added US-17e |

### Emotional Journey Map

```
Discovery → Interest → Confidence → Satisfaction → Advocacy
   ↓           ↓           ↓            ↓            ↓
  Landing   First scan  Can explain  Team aligned  Recommends
  page       results     to board      fixes work   to others
```

---

## Related Docs

- [UserStories-Yggdrasil.md](./UserStories-Yggdrasil.md) - All user stories
- [Integrations.md](./Integrations.md) - Data source integration details
- [WorkSplit-Yggdrasil.md](./WorkSplit-Yggdrasil.md) - Implementation timeline

---

## Story 3: First Mentoring Session

### Screen 1 — Landing Page
**Entry point. First impression. No login required.**
The user arrives at the landing page. The entire value proposition is communicated in under 10 seconds. Headline: "From Policy to Enforcement. In Minutes." Two CTAs: primary "Start Demo" (no account needed) and secondary "Learn More." Three stat cards across the bottom: 10,000+ Rules Extracted · 86% Detection Accuracy · under 5 seconds Scan Time. Dark minimal aesthetic — premium fintech feel.

> [!NOTE]
> **Design decision:** Demo mode bypasses all authentication using a hardcoded session UUID (00000000-0000-0000-0000-000000000001). Judges never see a login screen.

User clicks "Start Demo" → system sets demo session → redirects to Screen 2. No API call — client reads `NEXT_PUBLIC_DEMO_MODE=true`.

### Screen 2 — Start New Audit
**New in our updated flow. Each audit is independent — one policy, one dataset, one result.**
This screen is new. Each audit is a first-class object — scoped to one policy and one dataset, completely isolated from other audits. This enables audit history, comparison, and longitudinal tracking.

User gives the audit a name (e.g. "Q1 AML Review"). User picks from three policy frameworks shown as three cards side by side. The "Start Audit" button is disabled until both name and policy are selected.

- **AML Compliance** — 10 rules — CTR Threshold · Structuring Detection · SAR Triggers · Velocity Monitoring. Marked as Recommended for demo.
- **GDPR** — 10 rules — Data Retention · Consent · PII Protection · Encryption.
- **SOC2** — 12 rules — Access Control · Encryption · Audit Logging · Availability.

Primary demo uses AML — it has numeric thresholds ($10,000 CTR) that are easy to explain in 10 seconds. GDPR and SOC2 load and show rules but are not the focus of the demo.

User enters name, selects AML, clicks "Start Audit" → backend: `POST /api/audits` — creates scan record with `policy_id` and audit name.

### Screen 3 — Data Upload
**Upload the CSV dataset to scan against the selected policy.**
Policy is already chosen so this screen focuses entirely on the data side. Large drag-and-drop zone with instant feedback on upload.

Large dropzone: "Drop your CSV file here" with file type guidance below. Two info cards: Recommended Dataset (IBM AML — synthetic financial data with ground truth labels) and Also Supported (PaySim, Custom CSV). On upload the success state shows filename, row count, and column count immediately. Schema preview table appears below: column name, detected type, sample value — 5 rows shown.

> [!TIP]
> **Engineering note:** Papa Parse handles encoding issues (UTF-8, UTF-16, BOM) that corrupt raw file reads. Files are pre-filtered to amount ≥ $8,000 reducing IBM AML from 3 million rows to roughly 50,000 — scans stay under 5 seconds.

User drops `ibm_aml_sample.csv` → system shows "48,234 rows detected · 11 columns" + schema preview → backend: `POST /api/data/upload` — returns headers, sample rows, row count.

### Screen 4 — Rules List
**Review extracted rules before scanning — full transparency and control.**
After the policy is selected and data uploaded, the extracted rules are shown in a list. User can toggle individual rules on or off before running the scan.

Each rule shows: machine ID in monospace (`CTR_THRESHOLD`), human-readable name, short description, severity badge. Toggle switch per rule — all on by default. Severity colour coding: CRITICAL in red, HIGH in amber, MEDIUM in slate gray. Bottom sticky bar shows "10 rules selected" count with "Continue to Mapping →" button.

Example rules shown: `CTR_THRESHOLD` (Currency Transaction Report Threshold, CRITICAL), `STRUCTURING_PATTERN` (Structuring / Smurfing Detection, CRITICAL), `SAR_VELOCITY` (Suspicious Activity Report Velocity, HIGH), `BALANCE_MISMATCH` (Balance Inconsistency Detection, MEDIUM), `ROUND_AMOUNT` (Round Dollar Pattern Detection, MEDIUM).

User reviews rules, adjusts toggles if needed, clicks "Continue to Mapping →" → backend: `GET /api/policies/:id`.

### Screen 5 — Mapping Bridge + Clarification Questions
**The most technically impressive screen. AI maps your CSV columns to rule fields — you approve before the scan runs. Two sections on one screen.**

#### Section A — Column Mapping
Gemini (Agent 2) analyses the CSV headers and 5 sample rows. It returns a suggested mapping: `base_amt` → `amount`, `nameOrig` → `sender_id`, `nameDest` → `receiver_id`, `step` → `timestamp`, `type` → `transaction_type`. It also detects the dataset type (IBM AML) and sets a temporal scale of 24x — converting daily steps to hourly units that the rule engine understands. A confidence score per mapping is shown as a coloured progress bar. Low confidence mappings (below 90%) appear with an amber left border and an edit pencil icon. User can override any mapping before approving.

Mapping table: `amount` → `base_amt` at 98% confidence (green), `sender_id` → `nameOrig` at 96% (green), `receiver_id` → `nameDest` at 95% (green), `timestamp` → `step` at 91% (green), `transaction_type` → `type` at 89% (amber — review recommended).

A dataset banner shows: "Detected: IBM AML Format · Temporal Scale: 24x (daily → hourly)."

#### Section B — Clarification Questions
After mapping, Gemini (Agent 6) compares rule requirements against the detected columns and surfaces gaps or ambiguities. These are advisory — user can skip all of them.

- **Question 1 (Amber border):** "We mapped 'step' to timestamp with a 24x scale factor for IBM AML. Is this correct?" — answers: Yes, confirm / No, it's hourly.
- **Question 2 (Slate border):** "The BALANCE_MISMATCH rule requires oldbalanceOrg — we detected this column. Include this rule?" — answers: Yes, include / Skip this rule.

If Gemini returns zero questions the screen auto-shows "No clarifications needed, ready to scan." Questions are ADVISORY not blocking. Two buttons at bottom: "Skip All & Scan" (ghost button) and "Approve & Scan" (primary button). Scan runs either way.

User reviews mappings, answers or skips questions, clicks "Approve & Scan" → backend: `POST /api/data/mapping/confirm` (stores `mapping_config`, returns `mapping_id`) → `POST /api/scan/run`.

> [!IMPORTANT]
> **Why this matters:** Transparent Mapping — the user sees and approves every AI decision before any data is processed. This is what separates Yggdrasil from black-box tools and builds trust with compliance auditors.

### Screen 6 — Scan Running
**3–5 second focused transition. Purposeful, not a generic loading spinner.**
Full-screen focused state, no sidebar. The product communicates precision and progress. Circular progress ring in Azure blue with a shield icon inside — partially filled and rotating. Live counters update as the scan progresses: rules processed (7 of 10), violations found so far (312), estimated time remaining. Auto-advances to the dashboard when scan status flips to "completed." Frontend polls `GET /api/scan/:id` every 1 second.

> [!NOTE]
> **Architecture decision:** No WebSockets. Vercel serverless does not support persistent connections. Polling every second is invisible to users for a 3–5 second scan and eliminates an entire category of deployment risk during the hackathon.

### Screen 7 — Compliance Dashboard
**The hero screen. Every number is actionable. Sidebar returns.**
This is the screen judges will screenshot. Dense but organised.

- **Top row — 4 stat cards:** Compliance Score as a large radial gauge showing 73% in amber (warning zone), in large Playfair Display serif font. Critical Violations: 89 in red. High Risk: 143 in amber. Accounts Flagged: 47 in white.
- **Main content — two panels side by side:** Left panel (wider): Account Cases table — violations grouped by account ID, not individual rows. Right panel: Scan History — compliance score trend chart over last 5 scans plus list of previous audits with their scores.

Account Cases table shows: `C8234...` with 4 violations, CRITICAL severity, top rule `CTR_THRESHOLD`, $47,200 at risk. `M1923...` with 3 violations, CRITICAL, `STRUCTURING`, $29,800. `K4521...` with 2 violations, HIGH, `SAR_VELOCITY`, $31,500. Each row has a Review → link.

> [!TIP]
> **Key UX decision:** Compliance investigators work in cases (accounts), not individual rows. Grouping 312 violations into 47 account cases makes the dashboard usable. A flat list of 312 rows is not.

Bottom accuracy bar (full width): "Ground Truth Validation (IBM AML IsLaundering labels) · Precision 86% · Recall 95% · F1 Score 90%." Shown in a subtle green-tinted bar.

Compliance score formula: weighted by severity — CRITICAL violations count 3x, HIGH 2x, MEDIUM 1x against total records scanned. False positives marked by reviewers are excluded from the calculation.

User clicks an account case row → opens Evidence Drawer (Screen 8). Backend: `GET /api/violations/cases?scan_id=uuid`.

### Screen 8 — Evidence Drawer
**The moment that wins the demo. Policy text vs. transaction data, side by side.**
Slides in from the right overlaying the dashboard — dashboard visible but dimmed on the left. 60% width, full height. Violation ID in monospace at the top (`VIO-4821`), title "Structuring Pattern Detected", CRITICAL badge in red and account badge "Account C8234..." in blue.

#### Left panel — Policy Evidence
- **Section reference:** "Section 2 — Structuring Detection." Exact policy text with the key phrase highlighted: "Multiple transactions between $8,000 and $10,000 within a 24-hour window constitute structuring and must be reported to FinCEN." Rule logic in monospace below: `IF count(txns WHERE amount BETWEEN 8000–10000) >= 3 AND time_window <= 24 hours THEN flag = STRUCTURING`.

#### Right panel — Transaction Evidence
- **Three flagged transaction cards:** $9,500 · TRANSFER · step 142. $9,800 · TRANSFER · step 156. $9,200 · TRANSFER · step 163. Summary below: "$28,500 across 21 hours" — the pattern made visible.
- **Accuracy panel — The Differentiator:** "Rule Accuracy — Validated Against IBM AML Ground Truth (IsLaundering labels)." `STRUCTURING_PATTERN`: Precision 92% · Recall 95% · F1 93%. Caption: "We detected 95% of known structuring cases with 8% false positive rate."

#### Bottom action bar
"Add Review Note" text input (ghost style). "Mark as False Positive" secondary button — removes the violation from the score calculation. "Confirm Violation" primary button — locks it as confirmed. Compliance score on the dashboard recalculates immediately after either action.

User confirms or overrides → backend: `PATCH /api/violations/:id` — updates status, recalculates score.

> [!NOTE]
> **Conclusion:** Human-in-the-loop review is what separates Yggdrasil from black-box compliance tools.

//adding user flow for first mentoring session
Screen 1 — Landing Page
Entry point. First impression. No login required.
The user arrives at the landing page. The entire value proposition is communicated in under 10 seconds. Headline: "From Policy to Enforcement. In Minutes." Two CTAs: primary "Start Demo" (no account needed) and secondary "Learn More." Three stat cards across the bottom: 10,000+ Rules Extracted · 86% Detection Accuracy · under 5 seconds Scan Time. Dark minimal aesthetic — premium fintech feel.
Design decision: Demo mode bypasses all authentication using a hardcoded session UUID (00000000-0000-0000-0000-000000000001). Judges never see a login screen.
User clicks "Start Demo" → system sets demo session → redirects to Screen 2. No API call — client reads NEXT_PUBLIC_DEMO_MODE=true.

Screen 2 — Start New Audit
New in our updated flow. Each audit is independent — one policy, one dataset, one result.
This screen is new. Each audit is a first-class object — scoped to one policy and one dataset, completely isolated from other audits. This enables audit history, comparison, and longitudinal tracking.
User gives the audit a name (e.g. "Q1 AML Review"). User picks from three policy frameworks shown as three cards side by side. The "Start Audit" button is disabled until both name and policy are selected.
AML Compliance — 10 rules — CTR Threshold · Structuring Detection · SAR Triggers · Velocity Monitoring. Marked as Recommended for demo.
GDPR — 10 rules — Data Retention · Consent · PII Protection · Encryption.
SOC2 — 12 rules — Access Control · Encryption · Audit Logging · Availability.
Primary demo uses AML — it has numeric thresholds ($10,000 CTR) that are easy to explain in 10 seconds. GDPR and SOC2 load and show rules but are not the focus of the demo.
User enters name, selects AML, clicks "Start Audit" → backend: POST /api/audits — creates scan record with policy_id and audit name.

Screen 3 — Data Upload
Upload the CSV dataset to scan against the selected policy.
Policy is already chosen so this screen focuses entirely on the data side. Large drag-and-drop zone with instant feedback on upload.
Large dropzone: "Drop your CSV file here" with file type guidance below. Two info cards: Recommended Dataset (IBM AML — synthetic financial data with ground truth labels) and Also Supported (PaySim, Custom CSV). On upload the success state shows filename, row count, and column count immediately. Schema preview table appears below: column name, detected type, sample value — 5 rows shown.
Engineering note: Papa Parse handles encoding issues (UTF-8, UTF-16, BOM) that corrupt raw file reads. Files are pre-filtered to amount ≥ $8,000 reducing IBM AML from 3 million rows to roughly 50,000 — scans stay under 5 seconds.
User drops ibm_aml_sample.csv → system shows "48,234 rows detected · 11 columns" + schema preview → backend: POST /api/data/upload — returns headers, sample rows, row count.

Screen 4 — Rules List
Review extracted rules before scanning — full transparency and control.
After the policy is selected and data uploaded, the extracted rules are shown in a list. User can toggle individual rules on or off before running the scan.
Each rule shows: machine ID in monospace (CTR_THRESHOLD), human-readable name, short description, severity badge. Toggle switch per rule — all on by default. Severity colour coding: CRITICAL in red, HIGH in amber, MEDIUM in slate gray. Bottom sticky bar shows "10 rules selected" count with "Continue to Mapping →" button.
Example rules shown: CTR_THRESHOLD (Currency Transaction Report Threshold, CRITICAL), STRUCTURING_PATTERN (Structuring / Smurfing Detection, CRITICAL), SAR_VELOCITY (Suspicious Activity Report Velocity, HIGH), BALANCE_MISMATCH (Balance Inconsistency Detection, MEDIUM), ROUND_AMOUNT (Round Dollar Pattern Detection, MEDIUM).
User reviews rules, adjusts toggles if needed, clicks "Continue to Mapping →" → backend: GET /api/policies/:id.

Screen 5 — Mapping Bridge + Clarification Questions
The most technically impressive screen. AI maps your CSV columns to rule fields — you approve before the scan runs. Two sections on one screen.
Section A — Column Mapping
Gemini (Agent 2) analyses the CSV headers and 5 sample rows. It returns a suggested mapping: base_amt → amount, nameOrig → sender_id, nameDest → receiver_id, step → timestamp, type → transaction_type. It also detects the dataset type (IBM AML) and sets a temporal scale of 24x — converting daily steps to hourly units that the rule engine understands. A confidence score per mapping is shown as a coloured progress bar. Low confidence mappings (below 90%) appear with an amber left border and an edit pencil icon. User can override any mapping before approving.
Mapping table: amount → base_amt at 98% confidence (green), sender_id → nameOrig at 96% (green), receiver_id → nameDest at 95% (green), timestamp → step at 91% (green), transaction_type → type at 89% (amber — review recommended).
A dataset banner shows: "Detected: IBM AML Format · Temporal Scale: 24x (daily → hourly)."
Section B — Clarification Questions
After mapping, Gemini (Agent 6) compares rule requirements against the detected columns and surfaces gaps or ambiguities. These are advisory — user can skip all of them.
Question 1 (Amber border): "We mapped 'step' to timestamp with a 24x scale factor for IBM AML. Is this correct?" — answers: Yes, confirm / No, it's hourly.
Question 2 (Slate border): "The BALANCE_MISMATCH rule requires oldbalanceOrg — we detected this column. Include this rule?" — answers: Yes, include / Skip this rule.
If Gemini returns zero questions the screen auto-shows "No clarifications needed, ready to scan." Questions are ADVISORY not blocking. Two buttons at bottom: "Skip All & Scan" (ghost button) and "Approve & Scan" (primary button). Scan runs either way.
User reviews mappings, answers or skips questions, clicks "Approve & Scan" → backend: POST /api/data/mapping/confirm (stores mapping_config, returns mapping_id) → POST /api/scan/run.
Why this matters: Transparent Mapping — the user sees and approves every AI decision before any data is processed. This is what separates Yggdrasil from black-box tools and builds trust with compliance auditors.

Screen 6 — Scan Running
3–5 second focused transition. Purposeful, not a generic loading spinner.
Full-screen focused state, no sidebar. The product communicates precision and progress. Circular progress ring in Azure blue with a shield icon inside — partially filled and rotating. Live counters update as the scan progresses: rules processed (7 of 10), violations found so far (312), estimated time remaining. Auto-advances to the dashboard when scan status flips to "completed." Frontend polls GET /api/scan/:id every 1 second.
Architecture decision: No WebSockets. Vercel serverless does not support persistent connections. Polling every second is invisible to users for a 3–5 second scan and eliminates an entire category of deployment risk during the hackathon.

Screen 7 — Compliance Dashboard
The hero screen. Every number is actionable. Sidebar returns.
This is the screen judges will screenshot. Dense but organised.
Top row — 4 stat cards: Compliance Score as a large radial gauge showing 73% in amber (warning zone), in large Playfair Display serif font. Critical Violations: 89 in red. High Risk: 143 in amber. Accounts Flagged: 47 in white.
Main content — two panels side by side: Left panel (wider): Account Cases table — violations grouped by account ID, not individual rows. Right panel: Scan History — compliance score trend chart over last 5 scans plus list of previous audits with their scores.
Account Cases table shows: C8234... with 4 violations, CRITICAL severity, top rule CTR_THRESHOLD, $47,200 at risk. M1923... with 3 violations, CRITICAL, STRUCTURING, $29,800. K4521... with 2 violations, HIGH, SAR_VELOCITY, $31,500. Each row has a Review → link.
Key UX decision: Compliance investigators work in cases (accounts), not individual rows. Grouping 312 violations into 47 account cases makes the dashboard usable. A flat list of 312 rows is not.
Bottom accuracy bar (full width): "Ground Truth Validation (IBM AML IsLaundering labels) · Precision 86% · Recall 95% · F1 Score 90%." Shown in a subtle green-tinted bar.
Compliance score formula: weighted by severity — CRITICAL violations count 3x, HIGH 2x, MEDIUM 1x against total records scanned. False positives marked by reviewers are excluded from the calculation.
User clicks an account case row → opens Evidence Drawer (Screen 8). Backend: GET /api/violations/cases?scan_id=uuid.

Screen 8 — Evidence Drawer
The moment that wins the demo. Policy text vs. transaction data, side by side.
Slides in from the right overlaying the dashboard — dashboard visible but dimmed on the left. 60% width, full height. Violation ID in monospace at the top (VIO-4821), title "Structuring Pattern Detected", CRITICAL badge in red and account badge "Account C8234..." in blue.
Left panel — Policy Evidence:
Section reference: "Section 2 — Structuring Detection." Exact policy text with the key phrase highlighted: "Multiple transactions between $8,000 and $10,000 within a 24-hour window constitute structuring and must be reported to FinCEN." Rule logic in monospace below: IF count(txns WHERE amount BETWEEN 8000–10000) >= 3 AND time_window <= 24 hours THEN flag = STRUCTURING.
Right panel — Transaction Evidence:
Three flagged transaction cards: $9,500 · TRANSFER · step 142. $9,800 · TRANSFER · step 156. $9,200 · TRANSFER · step 163. Summary below: "$28,500 across 21 hours" — the pattern made visible.
Accuracy panel — The Differentiator:
"Rule Accuracy — Validated Against IBM AML Ground Truth (IsLaundering labels)." STRUCTURING_PATTERN: Precision 92% · Recall 95% · F1 93%. Caption: "We detected 95% of known structuring cases with 8% false positive rate."
Bottom action bar:
"Add Review Note" text input (ghost style). "Mark as False Positive" secondary button — removes the violation from the score calculation. "Confirm Violation" primary button — locks it as confirmed. Compliance score on the dashboard recalculates immediately after either action.
User confirms or overrides → backend: PATCH /api/violations/:id — updates status, recalculates score. Human-in-the-loop review is what separates Yggdrasil from black-box compliance tools.