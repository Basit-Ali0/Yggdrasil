# Architecture Overview: Yggdrasil

**Project:** Yggdrasil

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../../gist.md](../../gist.md). That file contains a plain-text summary of the entire project context.

**Related Docs:**
- [WorkSplit-Yggdrasil.md](../WorkSplit-Yggdrasil.md)
- [Integrations.md](../Integrations.md)
- [schema.md](../schema.md) - Database schema
- [execution/RuleEngine.md](../execution/RuleEngine.md) - Execution architecture

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js Frontend                          │   │
│  │   Guest Mode │ Policy View │ Mapping UI │ Dashboard │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP/REST
┌─────────────────────────┼───────────────────────────────────┐
│                     Server (Next.js API)                     │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Auth      │  │    CSV      │  │   Violation      │   │
│  │   Wrapper   │  │   Mapping   │  │   Service       │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
│         │                 │                    │              │
│         └────────────────┬┴───────────────────┘              │
│                          │                                   │
│         ┌────────────────▼────────────────┐                 │
│         │       RuleExecutor              │                 │
│         │  (Deterministic Engine)         │                 │
│         │  └─ Temporal Normalizer        │                 │
│         └─────────────────────────────────┘                 │
│                          │                                   │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │              Supabase (PostgreSQL + RLS)              │  │
│  │    - demo_session fallback logic                     │  │
│  │    - mapping_configs storage                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐
│   Gemini     │  │   pdf-parse │  │ Papa Parse│
│   (Mapping)  │  │   (Policy)  │  │ (CSV)     │
└──────────────┘  └─────────────┘  └───────────┘

---

## 🔄 Data Flow

### 1. Policy & Mapping Flow

```
User uploads PDF
       ↓
pdf-parse extracts text
       ↓
Gemini API → structured rules (JSON)
       ↓
User uploads CSV
       ↓
Gemini suggests Mapping (Headers → Rules)
       ↓
User approves Mapping (Transparent Mapping)
       ↓
Rules stored in DB with Mapping Config
```

### 2. Scan Flow (Deterministic)

```
Scan Triggered
       ↓
Temporal Normalizer (IBM=24x, PaySim=1x)
       ↓
For each rule:
       ↓
Apply approved Mapping Config
       ↓
Check deterministic logic (e.g., amount % 1000 == 0)
       ↓
Violations stored & Grouped by AccountID
```

---

## 🔒 Security & Auth Wrapper

**MVP Auth Strategy:**
- Toggle: `NEXT_PUBLIC_DEMO_MODE=true`
- Logic: `if (DEMO_MODE) useHardcodedSession() else useSupabaseAuth()`
- Session: Fixed persistent user session provisioned via script.
- RLS: Policies filter by `user_id`, which resolves to either the Supabase user or the Demo provisioned ID.

---

## ⚙️ Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard |
| `GEMINI_API_KEY` | Google Gemini API Key | Google AI Studio |
| `NEXT_PUBLIC_DEMO_MODE` | Set to 'true' for one-click demo | Local Env |
| `DEMO_USER_EMAIL` | Email for provisioned demo user | Local Env |
| `DEMO_USER_PASSWORD` | Password for provisioned demo user | Local Env |

┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js Frontend                          │   │
│  │   Dashboard │ Policy Upload │ Violations │ Export   │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP/REST
┌─────────────────────────┼───────────────────────────────────┐
│                     Server (Next.js API)                     │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Policy    │  │   Scan      │  │   Violation     │   │
│  │   Service   │  │   Engine    │  │   Service       │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
│         │                 │                    │              │
│  ┌──────┴────────────────┴────────────────────┴────────┐   │
│  │              Supabase (PostgreSQL + Auth)             │   │
│  │    - Policies, Violations, Scans tables              │   │
│  │    - Row Level Security                               │   │
│  │    - User Authentication                             │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────┼───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐
│   Gemini     │  │   PDF       │  │    CSV    │
│   API        │  │   Parser    │  │   Parser  │
└──────────────┘  └─────────────┘  └───────────┘
```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js Frontend                          │   │
│  │   Dashboard │ Policy Upload │ Violations │ Export   │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP/REST
┌─────────────────────────┼───────────────────────────────────┐
│                     Server (Next.js API)                     │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Policy    │  │   Scan      │  │   Violation     │   │
│  │   Service   │  │   Engine    │  │   Service       │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
│         │                 │                    │              │
│  ┌──────┴────────────────┴────────────────────┴────────┐   │
│  │              In-Memory Data Store                     │   │
│  │    (Policies, Rules, Violations, Scan History)      │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐
│   Gemini     │  │   PDF       │  │    CSV    │
│   API        │  │   Parser    │  │   Parser  │
└──────────────┘  └─────────────┘  └───────────┘
```

---

## 🔄 Data Flow

### 1. Policy Upload Flow

```
User uploads PDF
       ↓
pdf-parse extracts text
       ↓
Gemini API → structured rules (JSON)
       ↓
Rules stored in memory
       ↓
UI displays extracted rules
```

### 2. Scan Flow

```
User uploads CSV / connects data source
       ↓
Papa Parse extracts schema (columns, types)
       ↓
For each rule:
  - Match rule to relevant columns
  - Check data against conditions
  - Generate violation if match
       ↓
Violations stored with:
  - Rule ID
  - Policy excerpt
  - Data evidence
  - Severity
       ↓
Dashboard displays violations + score
```

### 3. Review Flow

```
User reviews violation
       ↓
Mark as: valid / false_positive / resolved
       ↓
Add review note (optional)
       ↓
Score recalculated
       ↓
Audit trail updated
```

---

## 🗂️ Data Model

For detailed schema, see [schema.md](../schema.md).

### Simplified View

| Entity | Description |
|--------|-------------|
| Policy | Uploaded PDF or prebuilt policy |
| Rule | Extracted compliance rule from policy |
| Scan | Compliance scan session |
| Violation | Individual rule violation |

### Relationships

```
Policy 1───N Rule
Scan 1───N Violation
Scan ──── Policy
```

---

## 🔌 API Layer

### Routes

| Path | Method | Description |
|------|--------|-------------|
| `/api/policies/ingest` | POST | Upload PDF, extract rules |
| `/api/policies/:id` | GET | Get policy with rules |
| `/api/data/upload` | POST | Upload CSV |
| `/api/scan/run` | POST | Run compliance scan |
| `/api/violations` | GET | List violations |
| `/api/violations/:id` | PATCH | Review violation |
| `/api/compliance/score` | GET | Get compliance score |
| `/api/scan/history` | GET | Get scan history |
| `/api/export` | GET | Export report |

---

## 🔒 Security Considerations

### Current (MVP)

- No authentication (single user)
- No PII in logs
- API keys in environment variables only

### Future (SaaS)

- Organization-based authentication
- Role-based access control
- API key isolation
- Audit logging

---

## 📈 Scalability Path

| Component | MVP | Future |
|-----------|-----|--------|
| Auth + DB | Supabase | Supabase (scale up) |
| Storage | Supabase Storage | S3 |
| Hosting | Vercel | Vercel Pro |

---

## 🧪 Testing Strategy

### Unit Tests

- Rule extraction logic
- Enforcement engine
- Score calculation

### Integration Tests

- API endpoints
- Data flow

### Manual Tests

- E2E user flows
- Demo scenarios
