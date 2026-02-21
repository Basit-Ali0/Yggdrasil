# Work Split: Yggdrasil

**Project:** Yggdrasil — Autonomous Policy-to-Data Compliance Engine
**Duration:** 24 hours (18 hours per person)
**Team Size:** 2 developers

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read `gist.md` in the root directory. That file contains a plain-text summary of the entire project context.

---

## 📋 Overview

### Team Structure

| Person | Primary Focus | Rationale |
|--------|---------------|-----------|
| **Person A** | Frontend UI + Pages | Visual, user-facing, storyteller |
| **Person B** | Logic + Backend + Services | Data engineering, AI pipelines, engine room |

**Both work in same Next.js project** — no separate backend repo.

### Independence Principle

- **70% independent work** — Enabled by Guest Mode (Hardcoded Session) and IndexedDB local data.
- **20% parallel integration** — Both work toward a shared `RuleExecutor` interface.
- **10% collaborative** — Hour 1 setup and Hour 18-24 demo practice.

---

## 🗓️ Hardened Hour-by-Hour Timeline

### Person A: Frontend & UX Specialist

| Hour | Task | Deliverable |
|------|------|-------------|
| 0-2 | **Guest Mode Splash** | One-click entry landing page; bypasses auth wall. |
| 2-4 | **App Shell & Ingestion UI** | Dashboard layout + PDF Drag-and-Drop component. |
| 4-8 | **Mapping Bridge UI** | Interface for AI-suggested column mapping & manual override. |
| 8-12 | **Dashboard Hero & Rollup** | Compliance Score Gauge + Account-based Case Rollup table. |
| 12-16| **Transparency UI** | Evidence Side-Drawer (Policy vs. Data) + Review System. |
| 16-18| **Reporting & Polish** | PDF Export generation + UX refinements (Empty states). |
| 18-24| **Demo & Buffer** | 2-minute walkthrough practice + final visual polish. |

### Person B: Logic & Backend Specialist

| Hour | Task | Deliverable |
|------|------|-------------|
| 0-2 | **Auth Wrapper & Clean-Pipe** | Provision persistent demo user; build BOM/Encoding/Sanitization utility. |
| 2-4 | **Two-Stage Rule Extraction** | Gemini pipeline (Text -> JSON rules) with Context Framing. |
| 4-8 | **Mapping & Engine Core** | Backend Mapping service + Deterministic Rule Engine (corrected math). |
| 8-12 | **Worker & Local Storage** | Web Worker implementation + IndexedDB (Dexie.js) for 50k sampling. |
| 12-16| **History & Audit API** | Scan history/delta detection + RLS-hardened Audit Log in Supabase. |
| 16-18| **Dataset & Infrastructure** | Golden Dataset validation (IBM/PaySim) + Vercel deployment check. |
| 18-24| **Deployment & Buffer** | Bug squashing + final E2E testing. |

---

## 🔌 Integration Checkpoints

1. **Hour 2:** Auth session working; Clean-Pipe utility available for frontend.
2. **Hour 6:** JSON rules extraction working; frontend can display rules.
3. **Hour 10:** Web Worker integrated; frontend can trigger scans and receive violations.
4. **Hour 14:** Cases Rollup integrated; dashboard shows grouped account violations.
5. **Hour 18:** Full E2E flow confirmed from PDF upload to PDF export.

---

## 🎯 Success Criteria (Hour 18)

- [ ] **Guest Mode:** One-click access to the dashboard.
- [ ] **Clean-Pipe:** Messy CSVs (UTF-16, BOM) parsed without crashing.
- [ ] **Transparent Mapping:** AI suggests columns; user approves before scan.
- [ ] **Deterministic Engine:** 50,000 rows scanned in <5s via Web Worker.
- [ ] **Explainability:** Side-by-side evidence view for every violation.
- [ ] **Audit Trail:** Human overrides saved and persisted in Supabase.

