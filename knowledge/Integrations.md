# Data Source Integrations: Yggdrasil

**Project:** Yggdrasil — Autonomous Policy-to-Data Compliance Engine  
**Status:** Ready for Implementation  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [WorkSplit-Yggdrasil.md](./WorkSplit-Yggdrasil.md) - Hour-by-hour work breakdown
- [UserStories-Yggdrasil.md](./UserStories-Yggdrasil.md) - US-5b (JSON), US-5c (Airtable)
- [API-Specification-Yggdrasil.md](./API-Specification-Yggdrasil.md) - API endpoint specs
- [gist.md](../gist.md) - Condensed project overview
- [policies/gdpr.json](../policies/gdpr.json) - Pre-built GDPR rules
- [policies/soc2.json](../policies/soc2.json) - Pre-built SOC2 rules
- [policies/aml.md](../policies/aml.md) - Pre-built AML rules

---

## Overview

This document details all data source integrations for Yggdrasil MVP. The app supports multiple ways to connect data for compliance scanning:

1. **CSV File Upload** - Primary data source
2. **JSON File Upload** - Alternative structured data
3. **Airtable** - Cloud spreadsheet/database
4. **Supabase PostgreSQL** - Direct database connection (future)

---

## Integration Matrix

| Data Source | Priority | Est. Effort | Auth Method | Library | Status |
|-------------|----------|-------------|-------------|---------|--------|
| **CSV (Standard)** | P0 | Done | None | Papa Parse | Implemented |
| **Financial CSV** | P0 | 1 hr | None | Papa Parse + Mapping Engine | To implement |
| **JSON Upload** | P2 | 1 hr | None | - | Deferred |
| **Airtable** | P2 | 3 hr | API Key | - | Deferred |
| **Supabase DB** | P2 | Deferred | API Key | - | Deferred |

---

## ⚡️ CSV Scale & Data Persistence Strategy

To maintain <5s scan times and ensure multi-user readiness:

| Data Type | Storage Location | Persistence Logic |
|-----------|------------------|-------------------|
| **Policy Metadata** | **Supabase DB** | Extracted rules & JSON logic persist per user (linked via RLS). |
| **Violation Evidence** | **Supabase DB** | Only the specific rows that fail rules are stored in the DB. |
| **Raw Sample Data** | **IndexedDB** | The 50,000 row CSV sample is stored in the browser (local only) for the scan session. |

### Mandatory Sampling Guardrail
1. **Limit:** 50,000 rows.
2. **Method:** First-N records.
3. **UI Signal:** A banner informs the user: "Scanning sample (first 50k records) for real-time performance. Full violations stored in DB."

---

## 1. CSV File Upload

**Status:** Implemented

### Implementation

- **Frontend:** File input with `accept=".csv"`
- **Library:** Papa Parse (`npm install papaparse`)
- **Backend:** `/api/data/upload` route parses CSV, extracts schema

### Expected Format

```csv
id,name,email,created_at
1,John Doe,john@example.com,2024-01-01
2,Jane Doe,jane@example.com,2024-01-02
```

### Schema Extraction

- Headers become column names
- First 5 rows sampled for type inference (string, number, date, boolean)
- Row count tracked for scan optimization

### Error Handling

- Empty file → "CSV file is empty"
- Malformed CSV → Error with line number
- Large file (>50MB) → Warning, process in background
- Non-CSV → "Only CSV files are supported"

---

## 2. JSON File Upload

**Priority:** P0  
**Estimated Effort:** 0.5-1 hour  
**Status:** To implement

### Implementation Steps

### Frontend: File Input (`app/data/page.tsx`)

```tsx
<input
  type="file"
  accept=".json"
  onChange={(e) => handleJsonUpload(e.target.files?.[0])}
  className="file-input"
/>
```

### Frontend: Upload Handler

```typescript
async function handleJsonUpload(file: File) {
  const text = await file.text();
  const data = JSON.parse(text);
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/data/upload', {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
}
```

### Backend: API Route (`app/api/data/upload/route.ts`)

```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  const text = await file.text();
  const data = JSON.parse(text);
  
  // Validate JSON structure
  if (!Array.isArray(data)) {
    return NextResponse.json(
      { error: 'JSON must be an array of records' },
      { status: 400 }
    );
  }
  
  if (data.length === 0) {
    return NextResponse.json(
      { error: 'JSON file is empty' },
      { status: 400 }
    );
  }
  
  // Extract schema from first record
  const schema = Object.keys(data[0] || {}).map(key => ({
    name: key,
    type: typeof data[0][key],
  }));
  
  return NextResponse.json({ data, schema, count: data.length });
}
```

### Expected JSON Format

```json
[
  { "id": 1, "name": "John", "email": "john@example.com" },
  { "id": 2, "name": "Jane", "email": "jane@example.com" }
]
```

### Key Considerations

- **Max file size:** 10MB (Next.js default limit)
- **Structure:** Must be array of objects
- **Nested objects:** Not supported - flatten or show error
- **Empty values:** Convert to null in schema

### Error Handling

| Error | Message |
|-------|---------|
| Empty file | "JSON file is empty" |
| Invalid JSON | "Invalid JSON format" |
| Not an array | "JSON must be an array of records" |
| Non-JSON file | "Only JSON files are supported" |
| Nested objects | "Nested objects are not supported, please flatten" |

### Performance Targets

- Parse time <1 second for <10MB
- Success rate >99%

---

## 3. Financial Transaction CSV (IBM AML / PaySim)

**Priority:** P0  
**Estimated Effort:** 1 hour  
**Status:** To implement  
**Recommended for:** Hackathon demo with ground truth validation

### Why This Data Source

The organizers recommend IBM AML and PaySim datasets because:
- **Ground truth labels** - `IsLaundering` (IBM) and `isFraud` (PaySim) enable validation
- **Realistic patterns** - Structured detection, layering, velocity violations
- **Deterministic rules** - CTR thresholds ($10K), structuring patterns ($8K-$10K)
- **Explainable outcomes** - Every violation can be traced to a rule

### Dataset Schemas

#### IBM AML Transactions

```csv
tran_id,orig_acct,bene_acct,tx_type,base_amt,tran_timestamp,IsLaundering,is_sar,alert_id
1001,5001,5002,WIRE,2850.00,15,true,true,1
```

| Column | Type | Description |
|--------|------|-------------|
| tran_id | int | Unique transaction ID |
| orig_acct | int | Originator account ID |
| bene_acct | int | Beneficiary account ID |
| tx_type | string | WIRE, CREDIT, DEPOSIT, ACH, TRANSFER |
| base_amt | float | Transaction amount |
| tran_timestamp | int | Time step (simulation day) |
| IsLaundering | boolean | Ground truth: is laundering |
| is_sar | boolean | SAR filed |
| alert_id | int | Alert ID (-1 if none) |

#### PaySim Transactions

```csv
step,type,amount,nameOrig,oldbalanceOrg,newbalanceOrig,nameDest,oldbalanceDest,newbalanceDest,isFraud,isFlaggedFraud
1,CASH_IN,2000.0,Customer123,0.0,2000.0,Customer456,0.0,2000.0,0,0
```

| Column | Type | Description |
|--------|------|-------------|
| step | int | Time unit (1 step = 1 hour) |
| type | string | CASH_IN, CASH_OUT, DEBIT, PAYMENT, TRANSFER |
| amount | float | Transaction amount |
| nameOrig | string | Sender account |
| oldbalanceOrg | float | Sender balance before |
| newbalanceOrig | float | Sender balance after |
| nameDest | string | Recipient account |
| oldbalanceDest | float | Recipient balance before |
| newbalanceDest | float | Recipient balance after |
| isFraud | int | Ground truth: is fraud (0/1) |
| isFlaggedFraud | int | System flagged (0/1) |

### Auto-Detection Logic

```typescript
function detectFinancialSchema(columns: string[]): 'ibm_aml' | 'paysim' | 'generic' {
  const ibmAMLColumns = ['tran_id', 'orig_acct', 'bene_acct', 'tx_type', 'base_amt', 'tran_timestamp', 'IsLaundering'];
  const paysimColumns = ['step', 'type', 'amount', 'nameOrig', 'oldbalanceOrg', 'newbalanceOrig', 'nameDest', 'oldbalanceDest', 'newbalanceDest', 'isFraud'];
  
  const hasIBM = ibmAMLColumns.every(col => columns.includes(col));
  const hasPaySim = paysimColumns.every(col => columns.includes(col));
  
  if (hasIBM) return 'ibm_aml';
  if (hasPaySim) return 'paysim';
  return 'generic';
}
```

### AML-Specific Schema Mapping

| Dataset | Account Column | Amount Column | Time Column | Type Column |
|---------|---------------|---------------|-------------|-------------|
| IBM AML | orig_acct, bene_acct | base_amt | tran_timestamp | tx_type |
| PaySim | nameOrig, nameDest | amount | step | type |

### Time Window Conversions

- 24 hours = 24 steps (PaySim)
- 7 days = 168 steps
- 30 days = 720 steps

### Error Handling

| Error | Message |
|-------|---------|
| Missing required columns | "Missing required columns for financial transaction schema" |
| Invalid amount format | "Amount must be a number" |
| Invalid timestamp | "Timestamp must be a positive integer" |

### Performance Targets

- Parse time <30 seconds for 6M records (use streaming)
- Detection accuracy against ground truth >85%

---

## 4. Airtable Integration

**Priority:** P0  
**Estimated Effort:** 2-3 hours  
**Status:** To implement

### Prerequisites

```bash
npm install airtable
```

### Environment Variables

```
AIRTABLE_API_KEY=your_personal_access_token
AIRTABLE_BASE_ID=your_base_id
```

### Implementation Steps

#### Step 1: Create Airtable Client (`lib/airtable.ts`)

```typescript
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID!
);

export async function fetchAirtableRecords(tableName: string) {
  const records = await base(tableName).select().all();
  
  return records.map(record => ({
    id: record.id,
    fields: record.fields,
  }));
}

export async function getAirtableSchema(tableName: string) {
  const records = await base(tableName).select({ maxRecords: 1 }).firstPage();
  
  if (records.length === 0) {
    return { fields: [] };
  }
  
  const fields = Object.keys(records[0].fields).map(key => ({
    name: key,
    type: typeof records[0].fields[key],
  }));
  
  return { fields };
}

export async function testAirtableConnection(apiKey: string, baseId: string, tableName: string) {
  const base = new Airtable({ apiKey }).base(baseId);
  
  try {
    await base(tableName).select({ maxRecords: 1 }).firstPage();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

#### Step 2: Create API Route (`app/api/data/airtable/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { fetchAirtableRecords, getAirtableSchema } from '@/lib/airtable';

export async function POST(request: Request) {
  const { apiKey, baseId, tableName } = await request.json();
  
  if (!apiKey || !baseId || !tableName) {
    return NextResponse.json(
      { error: 'Missing required fields: apiKey, baseId, tableName' },
      { status: 400 }
    );
  }
  
  try {
    const records = await fetchAirtableRecords(tableName);
    const schema = await getAirtableSchema(tableName);
    
    return NextResponse.json({
      data: records,
      schema,
      count: records.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

#### Step 3: Frontend Integration (`app/data/page.tsx`)

```tsx
function AirtableForm() {
  const [apiKey, setApiKey] = useState('');
  const [baseId, setBaseId] = useState('');
  const [tableName, setTableName] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/data/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, baseId, tableName }),
    });
    
    const result = await response.json();
    
    if (result.error) {
      alert(result.error);
    } else {
      // Success - store data and navigate
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        placeholder="API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <input
        type="text"
        placeholder="Base ID"
        value={baseId}
        onChange={(e) => setBaseId(e.target.value)}
      />
      <input
        type="text"
        placeholder="Table Name"
        value={tableName}
        onChange={(e) => setTableName(e.target.value)}
      />
      <button type="submit">Connect</button>
    </form>
  );
}
```

### Airtable API Details

- **Rate limit:** 5 requests/second
- **Free tier:** 1000 calls/month
- **Empty fields:** Return `undefined` (not included in response)
- **Field types:** Can be string, number, boolean, array, object

### Error Handling

| Error | Message |
|-------|---------|
| Invalid API key | "Invalid API key" |
| Invalid Base ID | "Base not found" |
| Table doesn't exist | "Table not found" |
| Rate limit exceeded | "Rate limit exceeded, please wait" |
| Empty table | "No records found in table" |

### Performance Targets

- Fetch time <5 seconds for <1000 records
- Connection success rate >95%

---

## 4. Unified Data Upload API

To simplify frontend integration, all data sources should use a unified endpoint:

### POST /api/data/upload

**Request:**

```typescript
// For CSV/JSON files
Content-Type: multipart/form-data
file: <file>

// For Airtable
Content-Type: application/json
{
  "source": "airtable",
  "apiKey": "...",
  "baseId": "...",
  "tableName": "..."
}
```

**Response:**

```json
{
  "source": "csv" | "json" | "airtable",
  "data": [...],
  "schema": {
    "tables": [{
      "name": "data",
      "columns": [
        { "name": "email", "type": "string" },
        { "name": "id", "type": "number" }
      ]
    }]
  },
  "count": 100
}
```

---

## Updated Work Timeline

| Hour | Person B Task | Deliverable |
|------|---------------|-------------|
| 4-5 | Add Airtable SDK | `lib/airtable.ts` ready |
| 5-6 | Airtable API route | `/api/data/airtable` works |
| 5 | Add JSON upload | `/api/data/upload` handles JSON |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `lib/airtable.ts` | Create | Airtable client and helpers |
| `app/api/data/airtable/route.ts` | Create | Airtable endpoint |
| `app/api/data/upload/route.ts` | Modify | Add JSON parsing + Financial CSV detection |
| `lib/financial-schema.ts` | Create | IBM AML / PaySim schema detection |
| `app/data/page.tsx` | Modify | Add JSON + Airtable + Financial CSV UI options |

---

## Testing Checklist

- [ ] CSV upload works with valid file
- [ ] CSV shows errors for invalid files
- [ ] JSON upload works with valid array
- [ ] JSON shows errors for empty/invalid files
- [ ] Airtable connects with valid credentials
- [ ] Airtable shows errors for invalid credentials
- [ ] Schema displays correctly for all sources
- [ ] Data count displays correctly
- [ ] Scan runs successfully with each data source
