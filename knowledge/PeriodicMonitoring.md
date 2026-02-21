# PRD: Manual Rescan with Diff Detection

**Project:** Yggdrasil  
**Feature:** Manual Rescan with Intelligent Diff Detection  
**Status:** Ready for Implementation  

---

## Problem Statement

The Problem Statement requires "periodic monitoring to detect future policy violations." However, live cron-based monitoring is out of hackathon scope. We need a solution that:

1. Allows users to manually trigger a rescan at any time
2. Detects changes in data since last scan to avoid redundant work
3. Shows delta: new violations, resolved violations, unchanged violations
4. Tracks compliance trends over time

---

## User Stories

### US-MON-01: Manual Rescan

**As a** user,  
**I want to** manually trigger a rescan of my data against the policy,  
**So that** I can check for new violations anytime.

**Acceptance Criteria:**
- [ ] User can click "Rescan" button on dashboard
- [ ] System detects if data has changed since last scan
- [ ] If no changes detected, system informs user "No new data to scan"
- [ ] If changes detected, system runs scan and shows results
- [ ] Scan completes in <5 seconds for typical datasets

### US-MON-02: Diff Detection

**As a** user,  
**I want the system to detect what changed in my data since the last scan,  
**So that** I don't waste time rescanning unchanged data.

**Acceptance Criteria:**
- [ ] System computes hash/checksum of data at scan time
- [ ] Before rescan, system compares current data hash to previous hash
- [ ] If hashes match, rescan is skipped with message "Data unchanged since last scan"
- [ ] If hashes differ, system identifies which records/tables changed
- [ ] Changed data is highlighted in scan results

### US-MON-03: Delta Display

**As a** user,  
**I want to see what violations are new, resolved, or unchanged since the last scan,  
**So that** I understand the compliance trajectory.

**Acceptance Criteria:**
- [ ] Dashboard shows: "New Violations", "Resolved Violations", "Unchanged"
- [ ] New violations highlighted in distinct color (e.g., red badge)
- [ ] Resolved violations shown with checkmark and strike-through
- [ ] Clicking a delta category filters the violations list
- [ ] Delta is calculated by matching violation signatures (rule + table + column)

### US-MON-04: Compliance Trends

**As a** user,  
**I want to see how my compliance score changes over time,  
**So that** I can track improvement or decline.

**Acceptance Criteria:**
- [ ] Dashboard shows line chart of compliance score over last 10 scans
- [ ] Chart is interactive (hover shows scan details)
- [ ] Trend line shows direction (improving ↗, declining ↘, stable →)
- [ ] User can click any point to view that scan's violations

---

## Technical Implementation

### Data Source-Specific Diff Detection

| Data Source | Diff Detection Method | UX Flow |
|-------------|----------------------|---------|
| **CSV Upload** | Compare file hash (SHA-256) | User uploads new CSV → System detects new file → Prompts "New file detected. Run scan?" |
| **JSON Upload** | Compare file hash + array length | User uploads JSON → System compares to previous → Shows "3 new records added" |
| **Airtable** | Compare record count + last modified timestamps | System queries Airtable API → Compares to last scan → Shows "5 records updated since last scan" |
| **Supabase** | Compare row counts + max(updated_at) per table | System queries information_schema → Compares to baseline → Shows schema changes detected |

### Hash Computation Strategy

```typescript
// CSV/JSON file hash
const computeFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Database hash (Airtable/Supabase)
const computeDataHash = async (records: any[]): Promise<string> => {
  const content = JSON.stringify(records.sort((a, b) => a.id.localeCompare(b.id)));
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};
```

### Delta Calculation Logic

```typescript
interface ScanDelta {
  newViolations: Violation[];
  resolvedViolations: Violation[];
  unchangedViolations: Violation[];
  scoreChange: number;
}

const calculateDelta = (previousViolations: Violation[], currentViolations: Violation[]): ScanDelta => {
  const previousSet = new Set(previousViolations.map(v => `${v.ruleId}-${v.table}-${v.column}`));
  const currentSet = new Set(currentViolations.map(v => `${v.ruleId}-${v.table}-${v.column}`));
  
  const newViolations = currentViolations.filter(v => !previousSet.has(`${v.ruleId}-${v.table}-${v.column}`));
  const resolvedViolations = previousViolations.filter(v => !currentSet.has(`${v.ruleId}-${v.table}-${v.column}`));
  const unchangedViolations = currentViolations.filter(v => previousSet.has(`${v.ruleId}-${v.table}-${v.column}`));
  
  return {
    newViolations,
    resolvedViolations,
    unchangedViolations,
    scoreChange: currentScore - previousScore
  };
};
```

---

## UX by Data Source

### CSV Upload Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Last Scan: 2026-02-15  |  Score: 78%  |  [Rescan] │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Rescan Clicked                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Drop new CSV file here                              │  │
│  │ or                                                 │  │
│  │ [Use Previous File]                                │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (if new file)
┌─────────────────────────────────────────────────────────────┐
│  File Uploaded                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ✓ New file detected                                │  │
│  │   Previous: users.csv (5,000 rows)                 │  │
│  │   Current: users.csv (5,200 rows) — +200 records   │  │
│  │                                                      │  │
│  │   [Cancel]  [Run Scan]                             │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Airtable Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Rescan Clicked                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Checking Airtable for changes...                    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Changes Detected                                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ✓ Data changed since last scan                     │  │
│  │   • 5 new records in 'customers' table            │  │
│  │   • 12 updated records in 'orders' table          │  │
│  │   • 3 deleted records in 'users' table             │  │
│  │                                                      │  │
│  │   [Cancel]  [Run Scan (200 records)]              │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### No Changes Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Rescan Clicked                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 🔍 Checking for changes...                         │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  No Changes                                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ℹ️ No changes detected since last scan              │  │
│  │                                                      │  │
│  │   Last scan: 2026-02-15 (3 hours ago)             │  │
│  │   Data hash: a1b2c3d4... (unchanged)              │  │
│  │                                                      │  │
│  │   [Cancel]  [Force Rescan Anyway]                 │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## API Updates

### New Endpoint: POST /api/scan/rescan

**Request:**

```json
{
  "policy_id": "uuid",
  "connection_id": "uuid",
  "force": false  // If true, skip diff check and scan anyway
}
```

**Response (changes detected):**

```json
{
  "should_scan": true,
  "delta": {
    "data_changed": true,
    "changes": {
      "type": "record_count",
      "table": "customers",
      "previous_count": 5000,
      "current_count": 5200,
      "change": "+200"
    }
  },
  "message": "200 new records detected. Run scan?"
}
```

**Response (no changes):**

```json
{
  "should_scan": false,
  "delta": {
    "data_changed": false,
    "previous_scan_at": "2026-02-15T10:00:00Z",
    "data_hash": "a1b2c3d4e5f6..."
  },
  "message": "Data unchanged since last scan. Force rescan?"
}
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Diff detection accuracy | 100% |
| Unchanged data skip rate | <2 seconds (hash only) |
| Delta calculation time | <500ms |
| UX: No changes message clarity | 100% users understand |
| Trend chart accuracy | Last 10 scans |

---

## Future Enhancements (Post-MVP)

| Feature | Description |
|---------|-------------|
| Scheduled rescan | Cron job for automatic periodic scanning |
| Slack/Email alerts | Notify on new violations |
| Webhook triggers | Integration with CI/CD |
| Policy version diff | Detect when policy changes |

---

## Related Documentation

- [API-Specification-Yggdrasil.md](./API-Specification-Yggdrasil.md)
- [Integrations.md](./Integrations.md)
- [UserStories-Yggdrasil.md](./UserStories-Yggdrasil.md)
