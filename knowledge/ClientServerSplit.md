# Client-Side vs Server-Side Processing: PolicyGuard AI

**Project:** PolicyGuard AI

---

## 🎯 Principle

**"Trust nothing, verify everything"**

- Never trust the client
- Keep secrets on the server
- Validate everything server-side
- Client is for presentation only

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                       │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  UI Components • Forms • State • Interactions    │     │
│  └─────────────────────────────────────────────────────┘     │
│                           │                                  │
│                     API Calls Only                           │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                         SERVER (Next.js)                      │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  API Routes • Business Logic • External Services   │     │
│  └─────────────────────────────────────────────────────┘     │
│                           │                                  │
│              ┌────────────┼────────────┐                   │
│              ▼            ▼            ▼                   │
│        ┌─────────┐ ┌──────────┐ ┌─────────┐            │
│        │ Supabase │ │  Gemini  │ │   PDF   │            │
│        │    DB    │ │    API   │ │  Parse  │            │
│        └─────────┘ └──────────┘ └─────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ MUST Be Server-Side (Never Client)

### 1. API Keys & Secrets

| Item | Location | Why |
|------|----------|-----|
| Gemini API Key | Server env only | Exposing = account compromise |
| Supabase Service Key | Server env only | Full database access |
| Database Credentials | Server env only | Security boundary |
| Encryption Keys | Server env only | Data protection |

**Implementation:**
```typescript
// ✅ CORRECT - Server-side only
const geminiKey = process.env.GEMINI_API_KEY;

// ❌ WRONG - Never expose to client
// const geminiKey = window.GEMINI_API_KEY;
```

### 2. AI/ML Processing

| Operation | Location | Why |
|-----------|----------|-----|
| Gemini API calls | Server | API key protection |
| Prompt construction | Server | Prompt injection prevention |
| Rule extraction logic | Server | IP protection |
| AI response parsing | Server | Output sanitization |

### 3. Database Operations

| Operation | Location | Why |
|-----------|----------|-----|
| Query execution | Server | SQL injection prevention |
| Schema inspection | Server | Security boundary |
| Data mutations | Server | Validation + authorization |
| Raw SQL | Server | Never expose to client |

### 4. File Processing

| Operation | Location | Why |
|-----------|----------|-----|
| PDF parsing | Server | Malware scanning capability |
| PDF text extraction | Server | Content validation |
| File storage | Server | Access control |

### 5. Business Logic

| Operation | Location | Why |
|-----------|----------|-----|
| Rule enforcement engine | Server | Logic protection |
| Violation detection | Server | Algorithm protection |
| Score calculation | Server | Integrity |
| Audit logging | Server | Tamper-proof |

### 6. Authentication & Authorization

| Operation | Location | Why |
|-----------|----------|-----|
| User login | Server | Credential handling |
| Session management | Server | Security |
| Permission checks | Server | Access control |
| Role validation | Server | Authorization |

---

## ✅ MUST Be Client-Side

### 1. UI Rendering

| Operation | Location | Why |
|-----------|----------|-----|
| Component rendering | Client | Performance |
| Page routing | Client | SPA experience |
| Animations | Client | Smooth UX |
| Form inputs | Client | Responsiveness |

### 2. User Interactions

| Operation | Location | Why |
|-----------|----------|-----|
| Button clicks | Client | Immediate feedback |
| Form input | Client | No network needed |
| Navigation | Client | Instant transition |
| Local state | Client | Performance |

### 3. Data Display

| Operation | Location | Why |
|-----------|----------|-----|
| Rendering violations | Client | No sensitive data |
| Displaying scores | Client | Read-only data |
| Showing progress | Client | UX only |
| Empty states | Client | UX only |

### 4. Client-Side Validation (Pre-validation Only)

| Operation | Location | Why |
|-----------|----------|-----|
| Email format | Client | UX + UX only |
| Required fields | Client | UX only |
| File type check | Client | UX only |

**Important:** Client validation is UX only. Server MUST validate again.

### 5. Local UI State

| Operation | Location | Why |
|-----------|----------|-----|
| Modal open/close | Client | UI state |
| Form draft | Client | No server needed |
| Session preferences | Client | UX only |
| Loading states | Client | UX only |

---

## ⚠️ Can Be Both (With Clear Boundaries)

### Data Fetching

| Operation | Client | Server |
|----------|--------|--------|
| Fetch violations list | ✅ Request | ✅ Process |
| Cache responses | ✅ Optional | N/A |
| Pagination | ✅ Request params | ✅ Process |

**Pattern:**
```typescript
// Client: Request with params
const violations = await fetch('/api/violations?page=1&limit=50');

// Server: Validate, process, return
// Never let client construct raw queries
```

### Form Handling

| Operation | Client | Server |
|----------|--------|--------|
| Input handling | ✅ Client | N/A |
| Client validation | ✅ Optional | N/A |
| Submission | ✅ Send data | ✅ Validate + process |

---

## ❌ Never Do This

### Never Client-Side

| Anti-Pattern | Why |
|--------------|-----|
| `process.env.API_KEY` in client code | Exposes secrets |
| Direct API calls to Gemini | Exposes API key |
| Database queries from client | SQL injection risk |
| Business logic in client | Can be bypassed |
| Raw SQL from client | Security breach |
| File processing in client | Limited + risky |

### Never Without Server Validation

| Operation | Why |
|-----------|-----|
| User permissions | Can be bypassed client-side |
| Data access control | Client can be manipulated |
| File uploads | Client can be bypassed |
| API rate limiting | Client can be manipulated |

---

## 📋 API Route Patterns

### Client → Server Contract

```
Client sends:
- Policy PDF file
- CSV file  
- Form data (validated)
- Pagination params
- Filter params (validated)

Server returns:
- Processed results
- Errors (if any)
- Metadata
```

### What Goes Where

```typescript
// ==================== SERVER ROUTES ====================

// app/api/policies/ingest/route.ts
// ✅ ALL of this is server-side:

export async function POST(request: Request) {
  // 1. Authenticate user
  const user = await authenticate(request);
  
  // 2. Validate input
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return error('No file');
  
  // 3. Process file (NEVER client)
  const text = await parsePDF(file);
  
  // 4. Call Gemini (NEVER client)
  const rules = await extractRules(text);
  
  // 5. Store in database
  const policy = await savePolicy(user.id, rules);
  
  // 6. Return result
  return json({ policy });
}

// ==================== CLIENT CODE ====================

// components/PolicyUploader.tsx
// ✅ ALL of this is client-side:

export function PolicyUploader() {
  const [uploading, setUploading] = useState(false);
  
  async function handleUpload(file: File) {
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Only sends file, doesn't process it
    const response = await fetch('/api/policies/ingest', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    setUploading(false);
    
    return result;
  }
  
  return <UploadButton onUpload={handleUpload} />;
}
```

---

## 🔐 Security Checklist

### Before Any Deployment

- [ ] No API keys in client code
- [ ] No secrets in environment variables prefixed with `NEXT_PUBLIC_`
- [ ] All API routes validate input
- [ ] All database queries use parameterized statements
- [ ] Authentication required for sensitive operations
- [ ] Authorization checks on every mutation
- [ ] Server-side validation matches client validation
- [ ] No raw SQL from client
- [ ] No business logic in client

### Environment Variables

```bash
# ==================== SERVER-SIDE ONLY ====================
# These are NEVER exposed to client:

GEMINI_API_KEY=sk-xxx          # ✅ Server only
SUPABASE_SERVICE_KEY=xxx        # ✅ Server only
DATABASE_URL=postgres://xxx     # ✅ Server only
SECRET_KEY=xxx                 # ✅ Server only

# ==================== CLIENT-SIDE ====================
# These CAN be exposed (public-safe only):

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co  # ✅ OK - public URL
NEXT_PUBLIC_APP_URL=http://localhost:3000          # ✅ OK - public URL
```

---

## 📝 Quick Reference

| Category | Server-Side | Client-Side |
|----------|-------------|--------------|
| API Keys | ✅ Always | ❌ Never |
| AI Processing | ✅ Always | ❌ Never |
| Database Queries | ✅ Always | ❌ Never |
| Business Logic | ✅ Always | ❌ Never |
| Authentication | ✅ Always | ❌ Never |
| File Processing | ✅ Always | ❌ Never |
| UI Rendering | ❌ Never | ✅ Always |
| User Input | ❌ Never | ✅ Always |
| Animations | ❌ Never | ✅ Always |
| Local State | ❌ Never | ✅ Always |
| Form Validation | ⚠️ Both | ⚠️ Both |
| Data Display | ❌ Never | ✅ Always |

---

## 🎓 Golden Rules

1. **Client is untrusted** — Never assume client data is valid
2. **Server is the gatekeeper** — All sensitive operations through server
3. **Defense in depth** — Validate on both sides
4. **Least privilege** — Client gets minimum needed
5. **Fail closed** — Default deny, explicit allow
