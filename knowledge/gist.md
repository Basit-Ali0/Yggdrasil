POLICYGUARD AI - PROJECT GIST

PROJECT OVERVIEW
PolicyGuard AI is an autonomous policy-to-data compliance engine built for a 24-hour hackathon. It bridges the gap between PDF policy documents and database enforcement by automatically extracting compliance rules from policies and scanning databases for violations.

TARGET USERS
Compliance Officers in SMEs, Data Governance Teams, Startup CTOs preparing for GDPR, DPDP, or SOC2 audits. AML Compliance Officers, Financial Crime Investigators, and Fraud Prevention Teams using transaction monitoring systems. These users have PDF policies drafted by legal and databases or CSV datasets, need quick visibility into compliance risks, and require audit-ready evidence.

PROBLEM SOLVED
Compliance teams manually interpret policy text, inspect schemas, run SQL checks, and prepare audit reports. This process is slow (hours), error-prone (human interpretation inconsistencies), and non-continuous (point-in-time checks only). There is no automated bridge between policy documents (PDFs) and database enforcement.

SOLUTION FLOW
1. User enters Demo Mode (Hardcoded Session - REQUIRED) or Logs in
2. User uploads PDF policy document
3. System extracts text and uses LLM to extract rules
4. LLM identifies rule candidates; user confirms/refines rules
5. User uploads CSV data
6. System identifies schema; LLM suggests column mapping (e.g., 'amt' -> 'amount')
7. User confirms/approves mapping (Transparent Mapping - REQUIRED)
8. System scans data against rules (Deterministic Normalization)
9. Violations generated with full explainability
10. Dashboard displays compliance score
11. User reviews violations, can override/approve
12. Export reports, share with team
13. Manual rescan with diff detection (no redundant scans)

KEY CAPABILITIES
- PDF-to-Rules: Converts free-text policies into structured compliance rules
- Explainable AI: Every violation includes policy excerpt and data evidence
- Transparent Schema Mapping: LLM suggests column mappings; user approves to avoid "black box" logic
- Guest/Demo Mode: One-click bypass for hackathon judging (Hardcoded Session)
- Deterministic Normalization: Logic scales IBM (Days) vs PaySim (Hours) to 1-hour units
- Human in the Loop: Override false positives, approve violations, track decisions
- Manual Rescan with Diff: Intelligent detection to avoid redundant scans
- Delta Display: Shows new, resolved, and unchanged violations between scans
- Compliance Trends: Visual chart showing score over last 10 scans
- Audit-Ready Export: Generate structured compliance reports, PDFs, shareable links
- Smart Heuristics: Auto-detect column types (email, phone, etc.), generate SQL for checks
- Remediation with SQL: Shows exactly how to fix each violation with SQL commands
- Myopic + Holistic Reviews: Single violation view and dependency-aware analysis
- Auth Readiness: Uses Hardcoded Session for MVP; toggle to Supabase Auth post-hackathon
- **Graceful Degradation: All features handle failure states (P0 - REQUIRED)**

AUTH & SECURITY (P0 - REQUIRED)
- Hardcoded Session Mode enabled for hackathon demo (`NEXT_PUBLIC_DEMO_MODE=true`)
- Session linked to fixed UUID to allow seamless DB linking
- Supabase Auth toggle ready for production deployment
- Row Level Security (RLS) on all tables
- Users can only access their own data (linked to session UUID)
- Encryption at rest (AES-256)
- TLS for data in transit
- Files are discarded after processing (no file storage - reduces audit surface)

DATA SOURCES (MVP)
1. CSV file upload - Papa Parse library (primary source)
2. Financial Transaction CSV - IBM AML / PaySim datasets with auto-detection & normalization
3. JSON/Airtable/Supabase - (Deferred to Post-Hackathon)

RECOMMENDED DATASETS FOR HACKATHON
- IBM Transactions for Anti-Money Laundering (AML) - Synthetic financial data with laundering labels
- PaySim - 6.3M synthetic mobile money transactions with fraud labels

These datasets provide ground truth labels (IsLaundering, isFraud) for validation.

INTEGRATION RESEARCH FINDINGS
Airtable Integration:
- Library: airtable npm package
- Auth: API key (personal access token)
- Steps: 1) Install airtable, 2) Create client with API key + base ID, 3) Fetch records from table, 4) Extract fields and map to schema
- API endpoint: POST /api/data/airtable
- Frontend: Form with API Key + Base ID + Table Name inputs
- Error handling: Invalid API key, invalid base ID, table not found, rate limit exceeded

JSON Upload Integration:
- Implementation: Native JavaScript JSON.parse()
- Frontend: <input type="file" accept=".json">
- Backend: Parse file.text(), validate isArray, extract schema from first record
- Expected format: [{ "field1": "value1", "field2": "value2" }, ...]
- Error handling: Empty file, invalid JSON, not an array, nested objects
- Max file size: 10MB

RULE TYPES EXTRACTED
GDPR/SOC2 Rules (P2 - Post-Hackathon):
- encryption: Data must be encrypted (POST-HACKATHON)
- consent: Consent required for data collection
- retention: Data retention periods
- prohibited: Prohibited data types
- format: Format validation requirements
- access: Access restriction rules

AML/Financial Rules (P0 - MVP):
- ctr_threshold: Currency Transaction Report threshold ($10,000)
- structuring: Smurfing pattern detection (multiple sub-$10K transactions)
- velocity_limit: High transaction frequency within time window
- amount_threshold: Transaction amount limits
- balance_mismatch: Balance inconsistency detection
- round_amount: Round-dollar pattern detection
- dormant_reactivation: Dormant account unusual activity
- sar_trigger: Suspicious Activity Report triggers

RULE COVERAGE MATRIX
Rule                 | IBM AML | PaySim | Status
---------------------|---------|--------|--------
CTR_THRESHOLD        |   ✅    |   ❌   | P0
CTR_AGGREGATION     |   ✅    |   ✅   | P0
STRUCTURING_PATTERN  |   ✅    |   ❌   | P0
SUB_THRESHOLD_VELOCITY|  ✅   |   ✅   | P0
SAR_THRESHOLD        |   ✅    |   ❌   | P0
SAR_VELOCITY         |   ✅    |   ✅   | P0
DORMANT_REACTIVATION |   ✅    |   ✅   | P0
BALANCE_MISMATCH     |   ❌    |   ✅   | P0
ROUND_AMOUNT_PATTERN |   ✅    |   ✅   | P0
FRAUD_INDICATOR      |   ❌    |   ✅   | P0
HIGH_VALUE_TRANSFER  |   ✅    |   ✅   | P0

TECH STACK
- Frontend + Backend: Next.js 14 (App Router)
- Database + Auth: Supabase (PostgreSQL + RLS) - Auth REQUIRED
- AI: Gemini API with Vercel AI SDK + Zod for structured output
- PDF Parsing: unjs/unpdf (serverless-compatible)
- CSV Parsing: Papa Parse
- Schema Validation: Zod
- UI Components: shadcn/ui + Tailwind CSS
- Icons: Lucide
- Charts: Recharts (via shadcn/ui)
- Deployment: Vercel (auto-deploy from GitHub)

EXECUTION ARCHITECTURE
- RuleExecutor: Abstraction layer for rule execution
- ExecutionBackend: Interface with WebWorkerBackend (default for 50k samples)
- Data Persistence: Supabase (Metadata/Violations) + IndexedDB (Local CSV Samples)
- Deterministic: LLM extracts rules, client-side Web Worker enforces (Bypasses Vercel timeouts)
- Future-proof: Swap execution backend without changing rule definitions

ACCELERATION PACKAGES
- zod: Schema validation for API inputs/outputs
- @vercel/ai: AI SDK with structured output support
- @google/generative-ai: Official Google GenAI SDK
- unjs/unpdf: Serverless PDF parsing (replaces pdf-parse)

API ENDPOINTS
- POST /api/policies/ingest - Upload PDF, extract rules
- POST /api/policies/prebuilt - Load prebuilt policy (aml/gdpr/soc2)
- POST /api/audits - Create a new named audit session
- GET /api/policies/:id - Get policy with rules
- POST /api/policies/:id/clarify - Get clarification questions
- POST /api/policies/:id/clarify/:questionId/answer - Submit clarification answer
- POST /api/policies/prebuilt - Get pre-built policies (GDPR, SOC2)
- POST /api/data/upload - Upload CSV/JSON
- POST /api/data/airtable - Connect to Airtable
- GET /api/schema - Get database schema
- POST /api/scan/run - Run compliance scan
- POST /api/scan/rescan - Rescan with diff detection
- POST /api/validate - Compute accuracy against ground truth labels
- GET /api/violations/cases - Get violations grouped by account
- POST /api/data/mapping/confirm - Confirm column mapping before scan
- GET /api/scan/history - Get scan history
- GET /api/violations - List violations
- PATCH /api/violations/:id - Review violation (update status)
- POST /api/rules/:ruleId/question - Personalized Q&A
- GET /api/compliance/score - Get compliance score
- GET /api/export - Export compliance report

DATA SCHEMAS
Rule: { rule_id, type, description, severity, conditions: { field, operator, value }, policy_excerpt }
Violation: { violation_id, rule_id, table, column, evidence, severity, policy_excerpt, explanation, status, reviewed_by, review_note, created_at, resolved_at }
Scan: { id, policy_id, score, violation_count, new_violations, resolved_violations, status, created_at, completed_at }

COMPLIANCE SCORE
Score 0-100% calculated from violations. Thresholds: 0-49% Red (Critical), 50-79% Yellow (Warning), 80-100% Green (Good). False positives excluded from score calculation after review.

SUCCESS METRICS
- Rule extraction precision >90%
- Violation detection accuracy >85%
- Scan completion <5 seconds
- False positive rate <15%
- 100% explainability coverage

USER STORIES COUNT
24 P0 (MVP): Upload PDF, View Rules, Select Pre-built Policy (GDPR/SOC2), View Pre-built Rules, Connect Supabase, Upload CSV, Upload JSON, Connect Airtable, View Schema, Run Scan, View Violations, View Violation Details, View Remediation Advice, Review Violation, Recalculate Score, View Compliance Score, View Scan History, View Compliance Trends (US-14b), Update Data & Rescan (US-14c), Issue Log (US-17b), Export Report, Export PDF (US-17c), Share via Link (US-17d), Share Summary Message (US-17e)
5 P1 (Post-MVP): Manual Rule Editing, Risk Heatmap, Download Audit Trail

PRE-BUILT POLICIES
The app includes pre-built compliance policy packs that users can select instead of uploading their own PDF:
- /policies/aml.md - AML Compliance Pack (10 rules) - CTR thresholds, structuring detection, velocity monitoring, SAR triggers - PRIMARY FOR HACKATHON
- /policies/gdpr.json - GDPR Compliance Pack (10 rules) - POST-HACKATHON
- /policies/soc2.json - SOC2 Compliance Pack (12 rules) - POST-HACKATHON
Users can select a pre-built policy or upload their own custom PDF policy.

TEAM STRUCTURE
2 developers working in same Next.js repo. Person A: Frontend UI + Pages. Person B: Backend Logic + Services. 70% independent work, 20% parallel integration, 10% collaborative.

TIMELINE (24 HOURS)
- Hours 0-1: Project setup, folder structure, Supabase schema
- Hours 1-6: Core Infrastructure (frontend shell, backend foundations)
- Hours 6-12: Feature Development (policy upload, data connection, scanning, violations)
- Hours 12-18: Integration & Polish (E2E flow, dashboard, export)
- Hours 18-24: Final Integration & Demo (testing, bug fixes, demo preparation)

KEY DIFFERENTIATORS FROM COMPETITORS
- Policy-to-data bridge (first product connecting PDF policies to database enforcement)
- Explainable AI (no black-box scoring, every violation has policy excerpt + evidence)
- Human in the loop (override false positives, track decisions)
- Concrete remediation suggestions
- Ground truth validation against labeled datasets (IBM AML, PaySim)

WHY NOT ML?
"For regulatory compliance, deterministic rules with explainability are required. ML is used downstream for prioritization scoring, not primary enforcement. This approach is audit-ready and matches industry practice for CTR/SAR reporting."

RULE PRIORITY MODEL
When multiple rules flag same transaction:
| Severity | Priority | Action |
|----------|----------|--------|
| CRITICAL | 1 | Auto-flag, require SAR review |
| HIGH | 2 | Flag for investigation |
| MEDIUM | 3 | Flag for monitoring |
Duplicate handling: Show all applicable rules

RISKS & MITIGATIONS
- Gemini extraction accuracy: Prompt engineering, manual rule editing capability
- False positives: Human review layer, override capability, <15% target rate
- Database schema complexity: Semantic column mapping via Gemini, manual override

MVP DELIVERABLES (HOUR 18)
- Upload PDF → Extract rules
- Connect database/CSV/JSON/Airtable → Get schema
- Run scan → Get violations
- View violations with details
- Human review (override/approve)
- Compliance score displayed
- Export working
- Responsive dashboard

POST-HACKATHON (DEFERRED)
- Scheduled cron-based monitoring (automatic periodic scans)
- Slack/Email alerts
- Real encryption validation
- Multi-policy support (GDPR + HIPAA + DPDP)
- Role-based access control
- API integration with CI/CD pipelines
- Automated remediation actions

DOCUMENTATION STRUCTURE

## Core (Start Here)
- gist.md - This file
- problem-statement.md - Ground truth requirements

## Product
- Feature-PolicyGuard-AI.md - Full specifications
- UserStories-PolicyGuard-AI.md - User stories + acceptance criteria
- WorkSplit-PolicyGuard-AI.md - Implementation timeline
- UserFlows.md - User flow stories

## Technical
- API-Specification-PolicyGuard-AI.md - API endpoints
- Integrations.md - Data source specs
- LLMSystemPrompts.md - LLM prompts + schemas
- TechStackAcceleration.md - Implementation guide
- PeriodicMonitoring.md - Manual rescan PRD

## Sample Data
- policies/gdpr.json - Sample policy (GDPR)
- policies/soc2.json - Sample policy (SOC2)
- policies/aml.md - Sample policy (AML/BSA) - 10 rules for transaction compliance

## Meta (Reference)
- meta/Setup.md, Architecture.md, ProductPositioning.md
- meta/DesignGuide.md, DataSecurity.md, DemoGuide.md

## Deprecated (Use Core Above)
- Brief-PolicyGuard-AI.md → Use Feature-PolicyGuard-AI.md
- PRFAQ-PolicyGuard-AI.md → Use Feature-PolicyGuard-AI.md
- ClarificationQuestions.md → Use UserStories + LLMSystemPrompts
- PolicyExtractionPipeline.md → Use LLMSystemPrompts
