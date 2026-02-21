# Frontend-Backend Integration Guide

**Project:** PolicyGuard AI  
**Purpose:** Minimize integration friction between frontend and backend developers  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.

---

## The Problem

Frontend and backend developers often face these integration issues:

| Problem | Cause | Solution |
|---------|-------|----------|
| "Your API doesn't match what I need" | No contract defined upfront | Define API contract first |
| "This field doesn't exist" | Schema mismatch | Share types/constants |
| "It works on my machine" | Different env setups | Standardize env |
| "I waited 2 hours for you" | Blocked on integration | Parallel development |
| "The merge is a nightmare" | No integration checkpoints | Regular integration |

---

## Our Integration Approach

### 1. Contract-First Development

**Before writing any code, define the API contract.**

```
Person B (Backend) defines API endpoints in API-Specification.md
Person A (Frontend) consumes these exact endpoints
Both agree on contract before Hour 2
```

**Rule:** No code written until contract is agreed upon.

### 2. Shared Types

**Single source of truth for all types.**

```typescript
// lib/types/index.ts - SHARED BY BOTH

export interface Violation {
  id: string;
  rule_id: string;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'resolved' | 'false_positive';
  evidence: any[];
  policy_excerpt: string;
  explanation: string;
}

export interface Scan {
  id: string;
  status: 'running' | 'completed' | 'failed';
  score: number;
  violation_count: number;
  created_at: string;
}
```

**Rule:** All types live in `lib/types/` and are shared. Both devs import from here.

### 3. API Contract Template

**Every endpoint must have this defined before implementation:**

```typescript
// Example: GET /api/violations

// Request
interface GetViolationsParams {
  scan_id?: string;
  severity?: 'high' | 'medium' | 'low';
  status?: 'open' | 'resolved' | 'false_positive';
  page?: number;
  limit?: number;
}

// Response
interface GetViolationsResponse {
  violations: Violation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

### 4. Integration Schedule

| Hour | Activity | Output |
|------|----------|--------|
| 1 | Define all API contracts | API-Spec.md updated |
| 2 | Share types/constants | `lib/types/` ready |
| 4 | Backend: First API ready | Test with curl |
| 4 | Frontend: API client ready | Can call endpoint |
| 6 | **Checkpoint 1** | Basic flow works |
| 8 | **Checkpoint 2** | Scan flow works |
| 10 | **Checkpoint 3** | Review flow works |
| 12 | **Checkpoint 4** | Full integration |

**Rule:** No one works past Hour 4 without a working integration checkpoint.

---

## Daily Integration Protocol

### Morning Standup (5 min)

Each dev shares:
1. What I built yesterday
2. What I'll build today
3. **Any API changes I need**

### Integration Check (Hourly)

If Person B modifies an API:
1. Update API-Spec.md immediately
2. Tell Person A in Slack/discord
3. Person A updates their API client

If Person A needs a new field:
1. Ask Person B in Slack/discord
2. Person B adds to API response
3. Both update types

### End of Day Merge

Before ending:
1. Push your code
2. Pull latest from main
3. Test your feature works
4. If broken, fix before leaving

---

## Files That Must Be Shared

| File | Owner | Shared With |
|------|-------|-------------|
| `lib/types/*.ts` | Person B | Person A |
| `app/api/*/route.ts` | Person B | Person A (via API contract) |
| `lib/api.ts` | Person A | Person B (for understanding) |
| `components/*` | Person A | Person B (for testing) |

---

## How to Test Without Each Other

### Person B: Test APIs with curl

```bash
# Test PDF upload
curl -X POST http://localhost:3000/api/policies/ingest \
  -F "file=@policy.pdf"

# Test scan
curl -X POST http://localhost:3000/api/scan/run \
  -H "Content-Type: application/json" \
  -d '{"policy_id": "123", "connection_id": "456"}'
```

### Person A: Test Frontend with Mock Data

```typescript
// During development, use mock data
const mockViolations = [
  { id: '1', severity: 'high', ... }
];

// In your API client, swap based on env
const getViolations = async () => {
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_API_URL) {
    return mockViolations; // Use mock in dev
  }
  return fetch('/api/violations').then(r => r.json());
};
```

---

## Common Integration Issues & Fixes

### Issue 1: Missing Field

```
Frontend expects: { id, name, email }
Backend returns:  { id, name }
```

**Fix:** 
1. Person A notices in browser console
2. Person A tells Person B
3. Person B adds missing field
4. Both verify

### Issue 2: Wrong Type

```
Frontend expects: number
Backend returns:  string
```

**Fix:**
1. Check in browser network tab
2. Person B fixes type in code
3. Verify in TypeScript errors

### Issue 3: Different Field Names

```
Frontend uses: violationCount
Backend uses: violation_count
```

**Fix:**
1. Agree on naming convention (camelCase)
2. Update API-Spec.md
3. Both update code

---

## Handoff Checklist

When Person B finishes an API:

- [ ] Endpoint works with curl
- [ ] Returns correct JSON structure
- [ ] Error cases handled
- [ ] Types updated in `lib/types/`
- [ ] API-Spec.md updated
- [ ] Person A notified

When Person A finishes a page:

- [ ] Uses correct API endpoints
- [ ] Handles loading states
- [ ] Handles error states
- [ ] Works with real API data
- [ ] Person B can test

---

## Communication Channels

| Channel | Use For |
|---------|---------|
| Slack/Discord #integrations | Quick questions, API changes |
| GitHub PRs | Code review, tracking changes |
| API-Spec.md | Source of truth for contracts |
| Daily standup | Blockers, dependencies |

---

## Emergency Protocol

If integration is completely blocked:

1. **Stop**: Don't keep working in isolation
2. **Call**: Voice call to discuss
3. **Fix**: Make minimal change to unblock
4. **Document**: Note what went wrong
5. **Resume**: Continue with agreed approach

---

## Quick Reference

### Key Integration Points

| Hour | What Must Work |
|------|----------------|
| 1 | Types defined, contracts agreed |
| 2 | Project runs, can call endpoints |
| 4 | Basic API → Frontend call works |
| 6 | Full policy upload → scan flow |
| 10 | Full review → score flow |
| 12 | Everything integrated |

### Don'ts

- Don't change API without telling Person A
- Don't assume "it will work somehow"
- Don't wait until end to integrate
- Don't skip the checkpoints

### Do's

- Do communicate API changes immediately
- Do test with real endpoints when possible
- Do use the shared types
- Do ask questions early

---

## Related Docs

- [WorkSplit-PolicyGuard-AI.md](../WorkSplit-PolicyGuard-AI.md) - Hour-by-hour tasks
- [API-Specification-PolicyGuard-AI.md](../API-Specification-PolicyGuard-AI.md) - API contracts
- [UserStories-PolicyGuard-AI.md](../UserStories-PolicyGuard-AI.md) - What to build
