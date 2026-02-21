# Failure Modes & Graceful Degradation

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../../gist.md](../../gist.md).

## 🛡️ Objective
To ensure PolicyGuard AI remains functional and professional during the hackathon demo, even when external dependencies fail or edge cases occur.

---

## 1. External API Failures

### Gemini (Rule Extraction / Mapping)
- **Scenario:** Gemini API times out or returns malformed JSON.
- **Degradation:**
    - Show a notification: "AI extraction is taking longer than expected."
    - Action: Offer a **"Load Pre-validated Policy"** button (loads `aml.json`).
    - Mapping: Fallback to strict header matching (e.g., must use exact standard field names).

---

## 2. Browser & Memory Failures

### CSV Out-of-Memory (OOM) & Large Files
- **Scenario:** User uploads a 500MB+ CSV or a file with messy encoding.
- **Mitigation:**
    - **IndexedDB (Dexie.js):** Sampled data (first 50,000 rows) is stored in IndexedDB, not LocalStorage, to avoid the 5MB limit.
    - **The Sanitization Pipe:** 
        - Strip Byte Order Marks (BOM).
        - Use `jschardet` for encoding detection.
        - Handle duplicate headers by appending indices (`Header_1`, `Header_2`).
    - **Papa Parse `step` Limit:** The parser stops after the 50,000 row threshold.
    - **Serverless Safety:** Raw data is NEVER sent to the backend; only violation evidence is persisted in Supabase.

### UI Thread Lockup
- **Scenario:** Rule Engine (O(N)) hangs the main thread during windowed aggregation.
- **Mitigation:**
    - Use a "Processing..." overlay with an animated progress bar.
    - **Deterministic Pre-Sort:** Always sort data by the temporal field (`step`) before aggregation to ensure sliding windows are idempotent and fast.
    - For future: Move `RuleExecutor` to a Web Worker.

---

## 3. Data Integrity Failures

### Missing Mandatory Columns
- **Scenario:** CSV mapping is approved, but the file is missing 'Amount'.
- **Degradation:**
    - The "Run Scan" button remains disabled.
    - Validation UI highlights the missing mapping in red.

### Temporal Unit Mismatch
- **Scenario:** User uploads IBM data but keeps scale at 1.0 (Hours).
- **Detection:**
    - If `max(step) < 100` and it's 1-hour units, flag as "Suspiciously short time range."
    - Prompt user: "Is this daily data? [Set Scale to 24x]".

---

## 4. Auth & Session Failures

### Supabase Connectivity
- **Scenario:** Supabase is down or rate-limited.
- **Mitigation:**
    - If `NEXT_PUBLIC_DEMO_MODE=true`, all storage operations fallback to **localStorage**.
    - The app remains 100% functional for the demo session.

---

## 5. Summary Table

| Component | Failure | Fallback Strategy |
|-----------|---------|-------------------|
| Policy PDF | Unreadable | Use Bullet Point manual entry |
| Rule Engine | OOM | Stop at 50,000 rows |
| Mapping | Low Confidence | Force manual Approval step |
| Database | Offline | LocalStorage (In-memory only) |
