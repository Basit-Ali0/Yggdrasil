# Graceful Degradation: Non-Negotiable Feature

**Project:** PolicyGuard AI  
**Status:** Required for MVP  

---

## Why This Is Non-Negotiable

Every feature in PolicyGuard AI must handle failure states gracefully. Users depend on this system for compliance audits. Failures should never leave users stranded or confused.

**Core Principle:** Partial success is still success. Complete failure should be rare.

---

## Failure Handling Requirements

### 1. LLM (Gemini API) Failures

| Failure Type | Handling Strategy | User Message |
|--------------|------------------|---------------|
| Rate limited (429) | Exponential backoff + retry | "High demand, retrying automatically..." |
| Timeout | Retry with longer timeout | "Taking longer than usual..." |
| Service unavailable | Circuit breaker opens, queue requests | "Service temporarily busy. Your request is queued." |
| Partial response | Parse what's valid, warn about gaps | "Partially processed. Review results carefully." |
| Complete failure | Offer cached results or manual review | "Unable to process. Contact support or try again." |

**Implementation Requirements:**
- [ ] Retry up to 3 times with exponential backoff
- [ ] Circuit breaker after 5 consecutive failures
- [ ] Timeout: 30 seconds for rule extraction
- [ ] Cache common policy rules for fallback

### 2. PDF Parsing Failures

| Failure Type | Handling Strategy | User Message |
|--------------|------------------|---------------|
| Encrypted PDF | Request unlocked version | "This PDF is password protected." |
| Corrupted file | Show error, suggest re-export | "Unable to read file. Try re-saving from original app." |
| Scanned image | Offer OCR queue | "This appears to be a scan. Queued for OCR processing." |
| Partial extraction | Show successful pages, flag failures | "Extracted X of Y pages. Review carefully." |
| Unsupported format | List supported formats | "File type not supported." |

**Implementation Requirements:**
- [ ] Validate file type before processing
- [ ] Extract page-by-page (isolate failures)
- [ ] Report quality score per page
- [ ] Allow retry for failed pages

### 3. Database Connection Failures

| Failure Type | Handling Strategy | User Message |
|--------------|------------------|---------------|
| Connection timeout | Retry with backoff | "Connection slow. Retrying..." |
| Auth failure | Prompt re-login | "Session expired. Please log in again." |
| Query timeout | Increase timeout, then fail gracefully | "Query taking longer than expected..." |
| Service down | Use stale cache if available | "Using cached data. Live data temporarily unavailable." |

**Implementation Requirements:**
- [ ] Connection timeout: 10 seconds
- [ ] Query timeout: 30 seconds
- [ ] Cache critical queries (policies, recent scans)
- [ ] Queue writes if offline, sync when reconnected

### 4. File Upload Failures

| Failure Type | Handling Strategy | User Message |
|--------------|------------------|---------------|
| File too large | Show size limit, suggest split | "File exceeds 50MB limit." |
| Network interruption | Auto-resume where possible | "Upload interrupted. Retrying..." |
| Partial upload | Resume from last chunk | "Resuming upload from X%..." |
| Invalid format | List accepted formats | "CSV/JSON only accepted." |

**Implementation Requirements:**
- [ ] Validate file size before upload
- [ ] Chunk large files (>5MB)
- [ ] Show upload progress
- [ ] Allow retry on failure

---

## Partial Success Handling

### Rule Extraction

When LLM partially extracts rules:

```json
{
  "successful": 8,
  "failed": 2,
  "rules": [...],
  "warnings": [
    "Could not parse rules from pages 5-6: unclear language",
    "Some rules marked as 'needs review'"
  ]
}
```

**Requirements:**
- [ ] Show which rules were extracted
- [ ] Highlight rules needing review
- [ ] Allow manual rule addition
- [ ] Never block scan due to partial extraction

### Violation Scanning

When scan completes partially:

```json
{
  "tablesScanned": 8,
  "tablesFailed": 2,
  "violations": [...],
  "errors": [
    "Table 'orders' has schema changes, skipped",
    "Connection lost during 'archive' scan"
  ]
}
```

**Requirements:**
- [ ] Show scan progress (X of Y tables)
- [ ] Display successful violations
- [ ] Allow rescan of failed tables
- [ ] Never lose already-scanned data

### Export Generation

When export partially fails:

```json
{
  "sectionsComplete": ["summary", "violations"],
  "sectionsFailed": ["trends"],
  "file": "partial-export.json",
  "message": "Trend data unavailable due to missing historical scans"
}
```

**Requirements:**
- [ ] Generate what's possible
- [ ] Clearly indicate what's missing
- [ ] Offer retry for failed sections

---

## User Communication Patterns

### Always Show

1. **What happened** — Clear, non-technical explanation
2. **What's working** — Highlight partial successes
3. **What's not working** — Be explicit about gaps
4. **What user can do** — Concrete next steps
5. **When it will be fixed** — If known, give timeline

### Never Show

- Raw error codes or stack traces
- Technical jargon ("circuit breaker open", "429 rate limit")
- Blame language ("you uploaded wrong file")
- Dead ends without alternatives

### Example Messages

| Scenario | Good Message |
|---------|-------------|
| LLM timeout | "Analysis taking longer than expected. You can continue waiting or try again." |
| PDF extraction partial | "Extracted 7 of 10 pages. Review extracted content below." |
| DB connection slow | "Retrieving your data... (this may take a moment)" |
| Scan interrupted | "Scan was interrupted. 80% complete. Resume scan?" |
| Export failed | "Report generation failed. Try exporting violations only." |

---

## Technical Implementation

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  canAttempt(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') return false; // Fast fail
    return true; // half-open = try one
  }
  
  recordFailure(): void {
    this.failures++;
    if (this.failures >= 5) this.state = 'open';
  }
  
  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
}
```

### Retry with Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number } = { maxRetries: 3, baseDelay: 1000 }
): Promise<T> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === options.maxRetries) throw error;
      await sleep(options.baseDelay * Math.pow(2, attempt));
    }
  }
  throw new Error('Exhausted retries');
}
```

### Partial Result Type

```typescript
interface PartialResult<T> {
  success: boolean;
  data?: T;
  partialData?: Partial<T>;
  warnings: string[];
  errors: string[];
  canRetry: boolean;
}
```

---

## Testing Requirements

| Scenario | Expected Behavior |
|----------|-----------------|
| LLM returns 429 | Auto-retry 3x, then show queue message |
| PDF has 10 pages, 3 fail | Show 7 pages, allow retry of 3 |
| DB timeout on 5th table | Complete first 4, show partial scan |
| Network drops mid-upload | Auto-resume from checkpoint |
| Export PDF fails | Generate JSON, notify PDF unavailable |

---

## Related Documentation

- [Feature-PolicyGuard-AI.md](./Feature-PolicyGuard-AI.md)
- [LLMSystemPrompts.md](./LLMSystemPrompts.md)
- [Integrations.md](./Integrations.md)
