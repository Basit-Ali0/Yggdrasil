# Component Map: Yggdrasil UI

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../../gist.md](../../gist.md).

## 🗺️ Objective
To define the core UI components and their responsibilities to ensure Person A and Person B remain aligned on data structures.

---

## 1. View: Landing Page / Guest Mode
- **Component:** `GuestModeSplash.tsx`
- **Purpose:** Brand introduction and "One-Click Demo" CTA.
- **Action:** Triggers the persistent auth script to sign in the demo user.

---

## 2. View: Ingestion Dashboard
- **Component:** `IngestionZone.tsx`
- **Purpose:** Dual upload area for PDF (Policy) and CSV (Data).
- **Sub-components:**
    - `PdfDropzone.tsx`: Handles PDF parsing state.
    - `CsvDropzone.tsx`: Triggers the Clean-Pipe utility.

---

## 3. View: The Mapping Bridge (Critical)
- **Component:** `MappingBridge.tsx`
- **Purpose:** Displays suggested column mappings for user confirmation.
- **Data Flow:** `LLM Mapping Suggestion` -> `UI Approval` -> `Scan Initialization`.
- **States:** `Draft`, `Conflict` (multiple columns mapped to same field), `Approved`.

---

## 4. View: Result Dashboard (Main)
- **Component:** `ComplianceDashboard.tsx`
- **Purpose:** High-level status overview.
- **Sub-components:**
    - `ScoreGauge.tsx`: Large radial gauge (Red/Yellow/Green).
    - `CaseTable.tsx`: Table grouped by `Account_ID` with violation badges.
    - `ScanHistory.tsx`: List of previous scans for the user.

---

## 5. View: Evidence Drawer
- **Component:** `EvidenceDrawer.tsx`
- **Purpose:** Deep dive into a specific violation.
- **Layout:** Split-screen.
    - Left: Policy Excerpt (Highlighting the rule).
    - Right: Data Evidence (Raw row values from CSV).
    - Bottom: Human Review Action buttons (Approve/Reject).

---

## 6. View: Rule Manager
- **Component:** `RuleList.tsx`
- **Purpose:** List of extracted JSON rules.
- **Responsibility:** Allows user to toggle specific rules "ON/OFF" before running a scan.
