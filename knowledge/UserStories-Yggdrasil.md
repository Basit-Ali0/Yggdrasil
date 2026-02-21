# User Stories: Yggdrasil

**Feature:** Yggdrasil — Autonomous Policy-to-Data Compliance Engine
**Status:** v1

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [Brief-Yggdrasil.md](./Brief-Yggdrasil.md)
- [Integrations.md](./Integrations.md)
- [API-Specification-Yggdrasil.md](./API-Specification-Yggdrasil.md)

---

## Epic 1: Policy Management

### US-1: Upload PDF Policy Document

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** upload a PDF policy document
**So that** I can start the compliance analysis process

**Acceptance Criteria:**
- [ ] User can select and upload a PDF file
- [ ] System validates PDF is readable
- [ ] System extracts text from PDF
- [ ] User sees upload progress indicator
- [ ] User receives confirmation when upload completes

**Edge Cases:**
- Empty PDF file → Show error "PDF is empty"
- Corrupted PDF → Show error "Unable to read PDF"
- Very large PDF (>10MB) → Show warning, allow proceed or cancel
- Scanned PDF (image only) → Show error "PDF contains no extractable text"
- Non-PDF file uploaded → Show error "Only PDF files are supported"

**Success Metrics:**
- Upload success rate >95%
- Average upload time <3 seconds

**Failure Scenarios:**
- Upload fails → Show retry button with error message

---

### US-2: View Extracted Rules

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see the rules extracted from my policy PDF
**So that** I can verify the extraction is accurate

**Acceptance Criteria:**
- [ ] Rules displayed in structured format
- [ ] Each rule shows: ID, type, description, severity
- [ ] User can view original policy excerpt for each rule
- [ ] User can edit extracted rules manually

**Edge Cases:**
- No rules extracted → Show message "No rules found. Try a different policy."
- Partial extraction → Show what was extracted, mark incomplete
- Ambiguous rules → Mark as "needs review"

**Success Metrics:**
- Rule extraction precision >90%
- All rules have policy excerpts

---

### US-3: Manual Rule Editing

**Priority:** P1 (Post-MVP)
**As a** compliance officer
**I want to** edit or add rules manually
**So that** I can correct extraction errors or add missing rules

**Acceptance Criteria:**
- [ ] User can edit existing rule fields
- [ ] User can add new rules
- [ ] User can delete rules
- [ ] Changes are saved and reflected in scans

**Edge Cases:**
- Invalid rule format → Prevent save, show validation error
- Duplicate rule ID → Auto-generate unique ID

---

## Epic 2: Database Connection

### US-4: Connect to Supabase Database

**Priority:** P1 (Post-MVP)
**As a** compliance officer
**I want to** connect to my Supabase PostgreSQL database
**So that** I can scan it for compliance violations

**Acceptance Criteria:**
- [ ] User can enter Supabase credentials (URL, API key)
- [ ] System validates connection
- [ ] User receives success/failure feedback
- [ ] Connection details are saved

**Edge Cases:**
- Invalid credentials → Show specific error "Invalid URL or API key"
- Network timeout → Show retry option
- Database doesn't exist → Show error "Database not found"
- Permission denied → Show error "Insufficient permissions"

**Success Metrics:**
- Connection success rate >95%
- Connection time <5 seconds

**Failure Scenarios:**
- Connection fails → Clear error message, retry option

---

### US-4b: Access Guest / Demo Mode

**Priority:** P0 (MVP)
**As a** hackathon judge
**I want to** access the platform without creating an account
**So that** I can instantly see the product's value

**Acceptance Criteria:**
- [ ] User can click "Guest Mode" on landing page
- [ ] System generates hardcoded session linked to fixed UUID
- [ ] System provides pre-populated sample data (Policy + CSV)
- [ ] User can still upload custom files in Demo Mode

---

### US-5: Upload CSV Dataset

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** upload a CSV file as the data source
**So that** I can test compliance against my records

**Acceptance Criteria:**
- [ ] User can select and upload a CSV file
- [ ] System parses CSV and extracts schema
- [ ] User can preview data structure
- [ ] CSV is sampled (first 50k rows) for performance

**Edge Cases:**
- Empty CSV → Show error "CSV file is empty"
- Malformed CSV → Show error with line number if possible
- Very large CSV (>50MB) → Apply mandatory sampling
- Non-CSV file → Show error "Only CSV files are supported"

**Success Metrics:**
- CSV parse success rate >98%
- Parse time <2 seconds for <10MB

---

### US-5b: Upload JSON Dataset

**Priority:** P2 (Deferred)
**As a** compliance officer
**I want to** upload a JSON file as an alternative to database connection

---

### US-5c: Connect to Airtable

**Priority:** P2 (Deferred)
**As a** compliance officer
**I want to** connect to my Airtable base

---

### US-6b: Map CSV Schema to Policy Rules

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** confirm or edit the AI's suggested column mapping
**So that** I ensure the rules are applied to the correct data fields

**Acceptance Criteria:**
- [ ] System suggests mappings (e.g., "txn_amt" -> "amount")
- [ ] User can manually change any mapping
- [ ] User must click "Approve Mapping" before running scan
- [ ] System warns if mandatory fields (amount, time) are unmapped

---

### US-5d: Select Pre-built Compliance Policy

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** select a pre-built compliance policy (GDPR or SOC2)
**So that** I can quickly start scanning without uploading my own PDF

**Acceptance Criteria:**
- [ ] User can select from pre-built policies: GDPR, SOC2
- [ ] Pre-built policies display name, description, rule count
- [ ] Selection loads policy rules immediately
- [ ] User can still upload custom PDF if needed

**Edge Cases:**
- No policy selected → Disable scan button, show tooltip "Select a policy"
- Policy load fails → Show error with retry option

**Success Metrics:**
- Policy selection <1 second
- Pre-built policy selection rate >70%

---

### US-5e: View Pre-built Policy Rules

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** view the rules included in a pre-built policy
**So that** I understand what will be checked against my data

**Acceptance Criteria:**
- [ ] Rules displayed in structured list
- [ ] Each rule shows: ID, type, description, severity
- [ ] User can see total rule count per policy
- [ ] Rules grouped by type (encryption, access, retention, etc.)

**Edge Cases:**
- Policy has no rules → Show error "Policy has no rules"
- Partial rule load → Show loaded rules with warning

**Success Metrics:**
- Rule display <500ms

---

## Epic 3: Compliance Scanning

### US-7: Run Compliance Scan

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** run a compliance scan against my database
**So that** I can identify policy violations

**Acceptance Criteria:**
- [ ] All tables listed with column details
- [ ] Column types displayed
- [ ] Sample values shown
- [ ] Search/filter functionality

**Edge Cases:**
- Empty database (no tables) → Show message "No tables found"
- Very large schema (>100 tables) → Paginate or virtualize list
- Permission denied on table → Show as "restricted"

---

## Epic 3: Compliance Scanning

### US-7: Run Compliance Scan

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** run a compliance scan against my database
**So that** I can identify policy violations

**Acceptance Criteria:**
- [ ] User can initiate scan with one click
- [ ] Progress indicator shows scan status
- [ ] Scan completes within 5 seconds on sample data
- [ ] Results displayed immediately after scan

**Edge Cases:**
- No policy uploaded → Disable scan button, show tooltip
- No data source connected → Disable scan button, show tooltip
- Scan timeout (>30 seconds) → Show partial results with warning
- Empty database → Show "No data to scan" message
- Scan interrupted → Show partial results option

**Success Metrics:**
- Scan completion rate >99%
- Average scan time <5 seconds on sample data

**Failure Scenarios:**
- Scan fails → Show error with retry option, log details

---

### US-8: View Violations List

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** view all detected violations
**So that** I can understand compliance status

**Acceptance Criteria:**
- [ ] Violations displayed in sortable table
- [ ] Each violation shows: severity, rule, table, column
- [ ] Filter by severity (high/medium/low)
- [ ] Filter by status (open/resolved/false positive)
- [ ] Search functionality

**Edge Cases:**
- 0 violations → Show success message "All compliant!"
- 1000+ violations → Paginate results (50 per page)
- No columns match rules → Show message "No violations found based on current rules"

---

### US-9: View Violation Details

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** view detailed information about a violation
**So that** I can understand why it was flagged

**Acceptance Criteria:**
- [ ] Violation detail shows all required fields
- [ ] Policy excerpt displayed prominently
- [ ] Data evidence shown (actual values)
- [ ] Explanation provided in plain language
- [ ] Severity badge displayed

**Edge Cases:**
- Missing evidence → Show "Evidence unavailable"
- Very long evidence → Truncate with expand option
- Deleted source data → Show "Data no longer available"

---

### US-9b: View Remediation Advice

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see actionable advice on how to fix each violation
**So that** I know exactly what steps to take to become compliant

**Acceptance Criteria:**
- [ ] Each violation displays remediation steps
- [ ] Remediation is specific to the violation type
- [ ] Links to relevant documentation when applicable
- [ ] Severity indicates priority of fix

**Remediation Examples:**
| Violation Type | Remediation |
|----------------|-------------|
| Unencrypted PII | Enable encryption at rest for table/column |
| Missing consent | Obtain valid consent from data subject |
| Expired retention | Delete records older than retention period |
| Unauthorized access | Remove unauthorized users, implement RBAC |
| No audit logging | Enable database audit logging |

**Edge Cases:**
- No remediation available → Show "Contact compliance team"
- Remediation requires admin → Show "Requires database admin"

**Success Metrics:**
- 100% of violations have remediation advice

---

## Epic 4: Human Review

### US-10: Review Violation

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** review a violation and mark it as valid/false positive
**So that** I can refine the compliance score

**Acceptance Criteria:**
- [ ] User can mark violation as "valid"
- [ ] User can mark violation as "false positive"
- [ ] User can add review notes
- [ ] Reviewer name recorded
- [ ] Timestamp recorded

**Edge Cases:**
- No note added → Allow save without note
- Very long note → Truncate in list view, full in detail
- Already reviewed → Allow re-review with history

---

### US-11: Recalculate Compliance Score

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see the compliance score update after reviews
**So that** I know the current compliance status

**Acceptance Criteria:**
- [ ] Score recalculates automatically after review
- [ ] Score displayed as percentage (0-100%)
- [ ] Score breakdown shown by rule type

**Edge Cases:**
- No violations → Score = 100%
- All violations marked false positive → Score = 100%
- No scan run → Show "Run scan to see score"

---

## Epic 5: Compliance Dashboard

### US-12: View Compliance Score

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see my overall compliance score
**So that** I can quickly understand compliance status

**Acceptance Criteria:**
- [ ] Score displayed prominently (large number)
- [ ] Score color-coded (green/yellow/red)
- [ ] Score breakdown by rule type shown

**Score Thresholds:**
- 0-49% = Red (Critical)
- 50-79% = Yellow (Warning)
- 80-100% = Green (Good)

**Edge Cases:**
- No scan yet → Show "No score available"
- Loading → Show skeleton loader

---

### US-13: View Risk Heatmap

**Priority:** P1 (Post-MVP)
**As a** compliance officer
**I want to** see a risk heatmap of violations
**So that** I can prioritize remediation efforts

**Acceptance Criteria:**
- [ ] Heatmap shows violations by table/severity
- [ ] Interactive: click to drill down
- [ ] Legend explains color coding

---

### US-14: View Scan History

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see a history of my scans
**So that** I can track compliance over time

**Acceptance Criteria:**
- [ ] List of past scans with dates
- [ ] Score shown for each scan
- [ ] Violation count shown for each scan

**Edge Cases:**
- No scans yet → Show empty state with CTA
- 100+ scans → Paginate or show last 10

---

### US-14b: View Compliance Trends

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see compliance trends visualized over my last 10 scans
**So that** I can understand if my compliance is improving or declining

**Acceptance Criteria:**
- [ ] Line chart showing compliance score over last 10 scans
- [ ] Bar chart showing violations by severity over time
- [ ] Default view shows last 10 scans
- [ ] User can see if score is improving or declining
- [ ] Time period clearly displayed

**User Flow:**
1. User navigates to dashboard or history page
2. System displays trend charts automatically
3. User can see upward/downward trends at a glance

**Edge Cases:**
- Less than 2 scans → Show "Need more data for trends"
- No trends yet → Show empty state with guidance

**Success Metrics:**
- Trend chart loads <1 second
- Clear trend direction visible within 3 seconds

---

### US-14c: Update Data and Rescan

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** update my CSV data file and rescan to check for new violations
**So that** I can monitor compliance as my data changes

**Acceptance Criteria:**
- [ ] User can upload new/updated CSV file
- [ ] System preserves column mappings if headers match
- [ ] User can run new scan with single click
- [ ] New violations highlighted compared to previous scan
- [ ] Resolved violations shown separately
- [ ] User notified of changes since last scan

**User Flow:**
1. User uploads updated data file
2. System detects new/changed data
3. User clicks "Rescan"
4. System runs scan and compares to previous
5. Results show new vs resolved violations

**Edge Cases:**
- Same data as before → Show "No changes detected"
- Data source deleted → Prompt to reconnect

**Success Metrics:**
- Rescan completes <5 seconds
- Delta calculation accurate 100%

---

## Epic 6: Monitoring

### US-15: Re-run Scan

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** re-run a compliance scan
**So that** I can check for new violations

**Acceptance Criteria:**
- [ ] User can trigger re-scan with one click
- [ ] New violations highlighted
- [ ] Resolved violations shown

**Edge Cases:**
- Same data as last scan → Show "No changes detected"
- Data source deleted → Show error, prompt to reconnect

---

### US-16: View Delta Between Scans

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see what changed between scans
**So that** I understand the compliance trajectory

**Acceptance Criteria:**
- [ ] "New violations" count displayed
- [ ] "Resolved violations" count displayed
- [ ] Each new violation linked to previous state

**Edge Cases:**
- First scan → Show "No previous scan to compare"
- Only one scan → Disable delta view

---

## Epic 7: Reporting & Export

### US-17: Export Compliance Report

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** export a compliance report
**So that** I can share it with auditors

**Acceptance Criteria:**
- [ ] User can download JSON format
- [ ] Report includes: score, violations, reviews, timestamps
- [ ] Report is audit-ready format

**Edge Cases:**
- No data to export → Show message "No data to export"
- Export fails → Show error with retry option
- Large export (>10MB) → Show progress, allow background

---

### US-18: Download Audit Trail

**Priority:** P1 (Post-MVP)
**As a** compliance officer
**I want to** download a complete audit trail
**So that** I can prove compliance to regulators

**Acceptance Criteria:**
- [ ] All actions logged with timestamps
- [ ] User who performed each action recorded
- [ ] Export includes all historical data

---

### US-17b: View Issue Log

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** see an organized log of all issues needing attention
**So that** I can track what needs fixing and track progress

**Acceptance Criteria:**
- [ ] List of all open violations grouped by severity
- [ ] Issues requiring immediate action highlighted
- [ ] Filter by severity, status, date
- [ ] Search functionality
- [ ] Each issue shows: violation, status, assigned reviewer, age

**Issue Log Display:**
| Field | Description |
|-------|-------------|
| ID | Unique violation ID |
| Severity | High/Medium/Low |
| Issue | Brief description |
| Status | Open/In Review/Resolved |
| Age | Days since detected |
| Assigned | Reviewer name |

**Edge Cases:**
- No issues → Show "All compliant!" message
- 1000+ issues → Paginate, prioritize by severity

---

### US-17c: Export Compliance Report as PDF

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** export a professional PDF report
**So that** I can share with stakeholders, auditors, and leadership

**Acceptance Criteria:**
- [ ] Generate professional PDF with company branding
- [ ] Include: cover page, executive summary, violations, remediation
- [ ] PDF follows audit-ready format
- [ ] Download with one click

**PDF Sections:**
1. Cover page with logo and report date
2. Executive summary (score, key findings)
3. Methodology (policies scanned, data sources)
4. Detailed findings (all violations)
5. Remediation recommendations

**Edge Cases:**
- No data → Show message before generating
- Large report → Show progress indicator

**Success Metrics:**
- PDF generates <3 seconds
- PDF is properly formatted

---

### US-17d: Share Report via Link

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** share a read-only link to the report
**So that** I can send to team members without them needing accounts

**Acceptance Criteria:**
- [ ] Generate unique shareable link
- [ ] Link is read-only (no editing)
- [ ] Link includes summary view
- [ ] Optional: set expiration (7/30/90 days)
- [ ] Copy link to clipboard with one click

**User Flow:**
1. User clicks "Share Report"
2. System generates unique link
3. User copies link or enters email
4. Recipient can view report summary

**Edge Cases:**
- Link expired → Show "Link expired" message
- Invalid link → Show 404

---

### US-17e: Share Review Summary as Message

**Priority:** P0 (MVP)
**As a** compliance officer
**I want to** share a brief summary of findings as a message
**So that** I can quickly update my team without full report

**Acceptance Criteria:**
- [ ] Generate brief text summary ( Slack/Teams ready)
- [ ] Include: score, critical issues count, top recommendations
- [ ] Copy to clipboard with one click
- [ ] Optional: customize before copying

**Message Template:**
```
📊 Compliance Report - [Org Name]
Score: 85% (Good)
🔴 Critical: 2 | 🟡 Warning: 5 | 🟢 Low: 3
Top Actions:
1. Encrypt email field in users table
2. Review retention policy for customer_data

Generated by Yggdrasil
```

**Edge Cases:**
- No issues → Generate success message

---

## Epic 8: Cross-Cutting Concerns

### CC-1: Loading States

**Priority:** P0 (MVP)
**As a** user
**I want to** see loading indicators during long operations
**So that** I know the system is working

**Acceptance Criteria:**
- [ ] Upload shows progress bar
- [ ] Scan shows spinner with status text
- [ ] All async operations have loading states

**Edge Cases:**
- Very fast operation (<200ms) → Skip loading state to reduce flicker

---

### CC-2: Error Handling

**Priority:** P0 (MVP)
**As a** user
**I want to** see clear error messages when something fails
**So that** I can understand and fix the issue

**Acceptance Criteria:**
- [ ] Connection failures show specific error
- [ ] Extraction failures show retry option
- [ ] Scan failures explain what went wrong

**Error Message Guidelines:**
- Be specific: "Invalid API key" not "Something went wrong"
- Be actionable: "Check your credentials" not "Error occurred"
- Be helpful: Show what to do next

---

### CC-3: Empty States

**Priority:** P0 (MVP)
**As a** user
**I want to** see helpful messages when there's no data
**So that** I know what to do next

**Acceptance Criteria:**
- [ ] No violations = success message with celebration
- [ ] No policy = upload prompt
- [ ] No connection = connect prompt

---

### CC-4: Responsive Design

**Priority:** P0 (MVP)
**As a** user
**I want to** use the app on different screen sizes
**So that** I can work on desktop or mobile

**Acceptance Criteria:**
- [ ] Dashboard works on 320px width
- [ ] Tables scroll horizontally on mobile
- [ ] Touch-friendly buttons on mobile (min 44px)

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## Priority Summary

| Priority | Count | Epic(s) |
|----------|-------|---------|
| P0 (MVP) | 24 | Policy Management, Database Connection, Compliance Scanning, Human Review, Dashboard, Monitoring, Reporting, Issue Tracking |
| P1 (Post-MVP) | 5 | Manual Rule Editing, Risk Heatmap, Audit Trail, Error Handling improvements |

---

## Story Mapping

```
Release 1 (MVP)
├── Policy Management
│   ├── Upload PDF (US-1)
│   ├── View Rules (US-2)
│   ├── Select Pre-built Policy (US-5d)
│   └── View Pre-built Rules (US-5e)
├── Database Connection
│   ├── Connect Supabase (US-4)
│   ├── Upload CSV (US-5)
│   ├── Upload JSON (US-5b)
│   ├── Connect Airtable (US-5c)
│   └── View Schema (US-6)
├── Scanning & Results
│   ├── Run Scan (US-7)
│   ├── View Violations (US-8)
│   ├── View Details (US-9)
│   └── View Remediation (US-9b)
├── Human Review
│   ├── Review Violation (US-10)
│   └── Recalculate Score (US-11)
├── Dashboard
│   ├── View Score (US-12)
│   ├── Scan History (US-14)
│   └── Compliance Trends (US-14b)
├── Monitoring
│   ├── Re-run Scan (US-15)
│   ├── View Delta (US-16)
│   └── Update Data & Rescan (US-14c)
├── Issue Tracking
│   └── Issue Log (US-17b)
└── Export & Sharing
    ├── Export Report (US-17)
    ├── Export PDF (US-17c)
    ├── Share via Link (US-17d)
    └── Share Summary (US-17e)

Post-MVP
├── Rule Management
│   └── Manual Editing (US-3)
├── Dashboard
│   └── Risk Heatmap (US-13)
└── Audit
    └── Download Trail (US-18)
```

---

## 📊 Success Metrics Summary

### Performance Metrics

| Metric | Target | Priority |
|--------|--------|----------|
| PDF upload time | <3 seconds | P0 |
| Rule extraction time | <5 seconds | P0 |
| Pre-built policy selection | <1 second | P0 |
| Pre-built rules display | <500ms | P0 |
| CSV parse time (<10MB) | <2 seconds | P0 |
| JSON parse time (<10MB) | <1 second | P0 |
| Airtable fetch time (<1000 records) | <5 seconds | P0 |
| Scan completion time | <5 seconds | P0 |
| Page load time | <1 second | P0 |
| API response time | <500ms | P1 |

### Accuracy Metrics

| Metric | Target | Priority |
|--------|--------|----------|
| Rule extraction precision | >90% | P0 |
| Violation detection accuracy | >85% | P0 |
| Explainability coverage | 100% | P0 |
| False positive rate | <15% | P0 |

### Reliability Metrics

| Metric | Target | Priority |
|--------|--------|----------|
| Upload success rate | >95% | P0 |
| Connection success rate | >95% | P0 |
| Scan completion rate | >99% | P0 |
| CSV parse success rate | >98% | P0 |
| JSON parse success rate | >99% | P0 |
| Airtable connection success rate | >95% | P0 |
| App uptime | >99.5% | P1 |

### User Experience Metrics

| Metric | Target | Priority |
|--------|--------|----------|
| Task completion rate | >90% | P0 |
| Error recovery rate | >80% | P0 |
| User satisfaction score | >4/5 | P1 |
| Support ticket rate | <5% of users | P1 |

---

## ⚠️ Failure Scenarios & Handling

### Critical Failures (Must Handle)

| Scenario | User Impact | Recovery |
|----------|-------------|----------|
| PDF upload fails | Cannot start | Retry with clear error |
| Connection fails | Cannot scan | Retry with specific error |
| Scan fails mid-way | Partial results | Option to retry or view partial |
| Export fails | Cannot share | Retry option |
| App crashes | Lost work | Auto-save, restore on reload |

### Degradation Modes

| Scenario | Behavior | User Notification |
|----------|----------|-------------------|
| Slow scan (>30s) | Show partial + warning | "Processing large dataset..." |
| Large file (>10MB) | Process in background | "File will be processed shortly" |
| Rate limited | Queue requests | "Please wait..." |

---

## ✅ Acceptance Criteria Checklist

### Before MVP Release

All P0 items must pass:

- [ ] Upload PDF works for valid PDFs
- [ ] Upload PDF shows errors for invalid files
- [ ] Rule extraction produces structured output
- [ ] Pre-built policy selection works (GDPR, SOC2)
- [ ] Pre-built policy rules display correctly
- [ ] CSV upload parses correctly
- [ ] JSON upload parses correctly
- [ ] Airtable connection fetches records
- [ ] Supabase connection validates credentials
- [ ] Scan completes within 5 seconds
- [ ] Violations display with all details
- [ ] Remediation advice shown for each violation
- [ ] Human review updates score
- [ ] Export produces valid JSON
- [ ] Export produces professional PDF
- [ ] Share link generates and copies
- [ ] Share summary copies to clipboard
- [ ] Dashboard shows compliance score
- [ ] Scan history shows last 10 scans
- [ ] Trends chart displays correctly
- [ ] Issue log displays all open violations
- [ ] Data update + rescan works
- [ ] Delta (new/resolved) shown correctly
- [ ] Loading states shown during operations
- [ ] Error messages are specific and actionable
- [ ] Empty states guide user actions
- [ ] Mobile responsive design works
