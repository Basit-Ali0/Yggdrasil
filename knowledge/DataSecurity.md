# Data Encryption & Security: Yggdrasil

**Project:** Yggdrasil  
**Status:** P0 (Required for MVP)  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

---

## Overview

This document outlines the data encryption and security architecture for Yggdrasil. We ensure user data remains private and accessible only to the user.

**Core Principle:** User data is encrypted such that even we (the platform) cannot access it without user authorization.

---

## Security Architecture

### Layered Approach

| Layer | What It Protects | Implementation |
|-------|-----------------|----------------|
| **Transport** | Data in transit | TLS 1.3 |
| **Storage** | Data at rest | AES-256 encryption |
| **Access** | Who can see data | Supabase RLS |
| **Isolation** | Cross-tenant | Organization-based |

---

## User Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                              │
│                                                              │
│  1. User signs in (Supabase Auth)                          │
│  2. User uploads data/policy                               │
│  3. Data encrypted client-side (optional for enterprise)     │
│  4. Sent over TLS to server                                 │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Yggdrasil Server                        │
│                                                              │
│  5. Store encrypted data (we cannot read)                  │
│  6. Apply RLS policies                                      │
│  7. Process only with user authorization                    │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│                                                              │
│  8. Data encrypted at rest (AES-256)                        │
│  9. RLS enforces: user can only see own data              │
│  10. No admin access to user data without audit log         │
└─────────────────────────────────────────────────────────────┘
```

---

## Encryption Implementation

### Supabase Built-in

**Encryption at Rest:**
- All Supabase data encrypted with AES-256
- Managed by Supabase/PostgreSQL
- Transparent to application

**Customer-Managed Keys (CMEK):**

```sql
-- Enable pgcrypto extension
CREATE EXTENSION pgcrypto;

-- Encrypt sensitive column
ALTER TABLE users 
ADD COLUMN email_encrypted bytea;

-- Encrypt
UPDATE users 
SET email_encrypted = pgp_sym_encrypt(email, current_setting('app.secret_key'));

-- Decrypt (only user can do this)
SELECT pgp_sym_decrypt(email_encrypted::bytea, current_setting('app.secret_key'))
FROM users 
WHERE id = auth.uid();
```

### For MVP (Standard Tier)

| Security Feature | Implementation |
|-----------------|-----------------|
| Encryption at rest | Supabase (AES-256) |
| Encryption in transit | TLS 1.3 |
| Authentication | Supabase Auth |
| Authorization | RLS policies |
| Data isolation | Organization-based |

### For Enterprise (Future)

| Security Feature | Implementation |
|-----------------|-----------------|
| Customer-managed keys | AWS KMS / GCP KMS |
| Field-level encryption | Custom implementation |
| Zero-knowledge | Client-side encryption |

---

## Row Level Security (RLS)

### RLS Architecture

```sql
-- Enable RLS on all user tables
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users see own policies"
  ON policies FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users see own violations"
  ON violations FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users see own scans"
  ON scans FOR ALL
  USING (user_id = auth.uid());
```

### What RLS Prevents

| Scenario | RLS Protection |
|----------|----------------|
| User A tries to view User B's policies | ❌ Blocked |
| User A tries to query User B's violations | ❌ Blocked |
| SQL injection trying to access other data | ❌ Blocked |
| Admin trying to view user data | ❌ Blocked (without special policy) |

---

## Auth Implementation (P0)

### Supabase Auth Setup

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword'
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword'
});

// Protected API call
const { data } = await supabase.functions.invoke('scan-run', {
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
```

### Auth-Protected Endpoints

All API endpoints require authentication:

| Endpoint | Method | Auth Required |
|----------|--------|---------------|
| /api/policies/* | POST, GET, PATCH, DELETE | ✅ |
| /api/data/* | POST, GET | ✅ |
| /api/scan/* | POST, GET | ✅ |
| /api/violations | GET, PATCH | ✅ |
| /api/compliance/* | GET | ✅ |
| /api/export/* | GET | ✅ |

---

## Data We Don't Access

### User Data (Encrypted/Private)

| Data Type | We Can Access? | Why |
|-----------|---------------|-----|
| Uploaded PDFs | ❌ No | Stored with user ownership |
| Policy JSON | ❌ No | User-owned, RLS protected |
| Scan results | ❌ No | User-owned |
| Violation data | ❌ No | User-owned |
| User emails | ❌ No | Supabase Auth only |

### Anonymous Telemetry (Aggregated)

| Data Type | We Can Access? | Why |
|-----------|---------------|-----|
| "Scan completed" count | ✅ Yes | Aggregated, no user ID |
| Feature usage | ✅ Yes | Anonymous |
| Error types | ✅ Yes | No PII |

See [Telemetry.md](./Telemetry.md) for details.

---

## Compliance Alignment

### GDPR Compliance

| Requirement | Implementation |
|-------------|-----------------|
| Data encryption | Supabase AES-256 |
| Access controls | RLS policies |
| Data deletion | CASCADE delete on user account |
| Right to access | User can export their data |
| Data portability | JSON export available |

### SOC2 Compliance

| Control | Implementation |
|---------|-----------------|
| CC6.1 Access control | Supabase Auth + RLS |
| CC6.7 Encryption | AES-256 at rest + TLS |
| CC7.2 Monitoring | Audit logs |
| CC7.3 Audit trail | Version history |

---

## Enterprise Options (Future)

### Zero-Knowledge Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Customer Browser                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 1. User enters passphrase                     │    │
│  │ 2. Derive key (PBKDF2)                       │    │
│  │ 3. Encrypt data locally                       │    │
│  │ 4. Send ONLY encrypted data to server         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Yggdrasil Server (Never sees plaintext)   │
│  - Stores encrypted data                                 │
│  - Cannot decrypt (no key)                              │
│  - Only stores/retrieves ciphertext                     │
└─────────────────────────────────────────────────────────┘
```

### Customer-Managed Keys (CMEK)

- Customer provides key via AWS KMS / GCP KMS
- Platform performs operations without seeing key
- Key rotation controlled by customer
- Enterprise tier feature

---

## Security Checklist (MVP)

- [ ] Supabase Auth enabled
- [ ] RLS enabled on all tables
- [ ] RLS policies tested for isolation
- [ ] TLS 1.3 for all connections
- [ ] No sensitive data in logs
- [ ] Environment variables secured
- [ ] API keys rotated regularly
- [ ] Audit log for admin access

---

## Related Docs

- [Telemetry.md](./Telemetry.md) - Privacy-first telemetry approach
- [SmartEngine.md](./SmartEngine.md) - RAG + pgvector with anonymized data
- [PolicyExtractionPipeline.md](./PolicyExtractionPipeline.md) - Policy extraction with privacy
