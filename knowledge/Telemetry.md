# Telemetry & Data: PolicyGuard AI

**Project:** PolicyGuard AI

---

## 🎯 Philosophy

We collect **anonymous telemetry** to improve the product while:
- Never storing user data that could be abused
- Keeping all compliance-related data in user's control
- Being transparent about what we collect
- Following industry best practices

---

## 📊 What We Collect

### Hackathon Scope (MVP)

| Data Point | Type | Purpose | Privacy |
|------------|------|---------|---------|
| Page views | Anonymous | Understand usage patterns | No PII |
| Feature usage | Anonymous | Know which features are used | No PII |
| Errors | Anonymous | Debug issues | No PII |
| Scan duration | Anonymous | Performance monitoring | No PII |

**Implementation:** Simple in-app analytics, no external services needed for MVP

### SaaS Scope (Post-Hackathon)

| Data Point | Type | Purpose | Privacy |
|------------|------|---------|---------|
| Page views | Anonymous | Usage analytics | No PII |
| Feature flags | Anonymous | A/B testing | No PII |
| Errors | Anonymous + stack trace | Debugging | No PII |
| Performance | Anonymous | Speed optimization | No PII |
| Crash reports | Anonymous | Stability | No PII |

**Implementation:** PostHog (self-hosted) or Plausible

---

## 🚫 What We NEVER Collect

| Data | Reason |
|------|--------|
| User email/name | Privacy risk |
| Policy content | Client data |
| Database content | Client data |
| IP addresses | PII |
| Location data | Privacy risk |
| User行为轨迹 | Privacy risk |

---

## 🏢 Data Architecture

### User Data (User Control)

```
┌─────────────────────────────────────────────────────────────┐
│                    User Data (Client-Owned)                   │
├─────────────────────────────────────────────────────────────┤
│  - Policy PDFs                                             │
│  - Database schemas                                        │
│  - Violation data                                          │
│  - Review notes                                            │
│                                                              │
│  → Stored in user's Supabase project                      │
│  → User has full control                                  │
│  → Deleted when user deletes                              │
└─────────────────────────────────────────────────────────────┘
```

### Anonymous Telemetry (Our Control)

```
┌─────────────────────────────────────────────────────────────┐
│                 Anonymous Telemetry (We Own)                  │
├─────────────────────────────────────────────────────────────┤
│  - "Scan completed" (count only)                          │
│  - "Page visited" (count only)                            │
│  - "Error occurred" (type only)                           │
│  - "Duration" (aggregate only)                             │
│                                                              │
│  → Stored separately from user data                       │
│  → Never linked to user identity                          │
│  → Aggregated immediately                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Compliance Data Handling

### For Our System (Improves AI)

| Data | Format | Purpose |
|------|--------|---------|
| Rule extraction success rate | Count only | Improve AI |
| Common rule patterns | Aggregate only | Improve prompts |
| Violation detection accuracy | Count only | Improve engine |

**Note:** We NEVER process, store, or access user compliance data. All policy documents, database schemas, violation data, and remediation advice remains entirely under user control. See [policies/gdpr.json](../../policies/gdpr.json) and [policies/soc2.json](../../policies/soc2.json) for pre-built policy formats.

For future "smart" features that learn from patterns while maintaining privacy, see [SmartEngine.md](./SmartEngine.md).

### For User (Their Compliance)

| Data | Owner | Control |
|------|-------|---------|
| Policy excerpts | User | Full control |
| Violation evidence | User | Full control |
| Audit trails | User | Full control |
| Review notes | User | Full control |

---

## 🛡️ Industry Best Practices Applied

### From Research (Vercel, Supabase, Stripe patterns)

1. **Default to anonymous** — Collect only what we need
2. **Aggregate early** — Never store raw events with identifiers
3. **Exclude PII** — Never collect emails, names, IPs
4. **Data retention** — Keep telemetry for X days, then delete
5. **Transparency** — Document what we collect
6. **Opt-out** — Allow users to disable telemetry

---

## 📋 Implementation Plan

### Hackathon Scope (MVP)

```typescript
// Simple anonymous event tracking
const trackEvent = (event: string, data?: Record<string, number>) => {
  // No PII, no user ID, no IP
  console.log({
    event,           // e.g., "scan_completed"
    data,            // e.g., { duration_ms: 5000, violations: 3 }
    timestamp: Date.now()
  });
};
```

**What to track (MVP):**
- `scan_completed` — count + duration
- `policy_uploaded` — count
- `error_occurred` — error type only

### SaaS Scope (Post-Hackathon)

| Tool | Purpose | Free Tier |
|------|---------|----------|
| PostHog | Product analytics | Yes (self-hosted option) |
| Sentry | Error tracking | Yes |
| Plausible | Website analytics | Yes |

---

## 🔐 Legal Considerations

### GDPR Compliance

- ✅ No personal data collected
- ✅ No cookies required
- ✅ No user tracking
- ✅ Data retention policy applied
- ✅ Anonymous by design

### CCPA Compliance

- ✅ No sale of data
- ✅ No personal information
- ✅ Right to delete (applies to user data only)

---

## 📝 Documentation

We document in our privacy policy:

1. What data we collect
2. Why we collect it
3. How we protect it
4. How to opt-out
5. Data retention periods

---

## ✅ Checklist

### For Every Telemetry Event

- [ ] No user ID
- [ ] No email/name
- [ ] No IP address
- [ ] No policy content
- [ ] No database content
- [ ] No violation evidence
- [ ] Aggregate-friendly format
