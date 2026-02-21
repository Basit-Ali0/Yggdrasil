# Tech Stack Acceleration Opportunities

**Project:** Yggdrasil  
**Purpose:** Document recommended packages and implementation acceleration strategies  
**Status:** Ready for Implementation  

---

## Overview

This document outlines recommended packages and implementation strategies to accelerate development. All recommendations are based on 2026 ecosystem research and integrate well with our chosen stack (Next.js, Supabase, shadcn/ui).

---

## Recommended Package Additions

### Core Acceleration

| Package | Purpose | Install Command | Time Saved |
|---------|---------|----------------|------------|
| **zod** | Schema validation for all API inputs/outputs | `npm install zod` | 3-5 hours |
| **@vercel/ai** | AI SDK with structured output | `npm install @vercel/ai` | 4-6 hours |
| **@google/generative-ai** | Official Google GenAI SDK | `npm install @google/generative-ai` | 1-2 hours |
| **unjs/unpdf** | Serverless PDF parsing | `npm install unpdf` | 2-4 hours |

### Optional Enhancements

| Package | Purpose | Install Command | Time Saved |
|---------|---------|----------------|------------|
| **csv-parser** | Faster Node.js CSV parsing | `npm install csv-parser` | 1-2 hours |
| **@trigger.dev/schema-infer** | Auto-schema from JSON | `npm install @trigger.dev/schema-infer` | 2-3 hours |

### Already Included (from shadcn/ui)

| Component | Purpose |
|-----------|---------|
| **Recharts** | Charts (via shadcn/ui charts) |
| **Lucide React** | Icons (via shadcn/ui) |
| **Tailwind CSS** | Styling (via shadcn/ui) |

---

## Implementation Acceleration Strategies

### 1. PDF Parsing: unjs/unpdf

**Why:** pdf-parse has issues with serverless (Vercel) due to native dependencies. unjs/unpdf is designed for serverless environments.

**Before (pdf-parse):**
```typescript
// ❌ Breaks in serverless environments
import pdf from 'pdf-parse';
const data = pdf(pdfBuffer);
```

**After (unjs/unpdf):**
```typescript
// ✅ Works in Vercel, Cloudflare, Node.js
import { PDFDocument } from 'unpdf';
const pdfDoc = await PDFDocument.load(pdfBuffer);
const text = await pdfDoc.getText();
```

**Time Saved:** 2-4 hours debugging serverless issues

---

### 2. Schema Validation: Zod

**Why:** Critical for type safety and API input validation. Prevents runtime errors and enables better DX.

**Usage:**
```typescript
import { z } from 'zod';

// Define schemas once
const PolicyUploadSchema = z.object({
  file: z.instanceof(File),
  name: z.string().min(1)
});

const ViolationUpdateSchema = z.object({
  status: z.enum(['open', 'resolved', 'false_positive']),
  review_note: z.string().optional()
});

// Use in API routes
export async function POST(request: Request) {
  const body = await request.json();
  const result = PolicyUploadSchema.safeParse(body);
  
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.issues },
      { status: 400 }
    );
  }
  
  // Process validated data
  const { name } = result.data;
}
```

**Time Saved:** 3-5 hours on validation code

---

### 3. LLM Integration: Vercel AI SDK

**Why:** Provides structured output support, unified API across providers, streaming, and better error handling.

**Before (Direct API):**
```typescript
// ❌ Manual parsing, no streaming support
const response = await fetch('https://generativelanguage.googleapis.com/...', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({ contents: [...] })
});
const text = await response.text();
const json = JSON.parse(text);
```

**After (Vercel AI SDK):**
```typescript
// ✅ Structured output, streaming, unified API
import { generateText } from 'ai';

const { text } = await generateText({
  model: google('gemini-2.0-flash'),
  prompt: 'Extract rules from: ' + pdfText,
  schema: ExtractionResultSchema
});
```

**Time Saved:** 4-6 hours on LLM integration

---

### 4. Shadcn/ui Components

**Time Saved:** 10-15 hours on UI development

Use these components from shadcn/ui:

| Component | Use Case |
|-----------|----------|
| `Button` | All click actions |
| `Card` | Score display, rule cards |
| `Table` | Violations list, scan history |
| `Badge` | Severity tags (high/medium/low) |
| `Dialog` | Violation details, confirmations |
| `Input` | Text fields, search |
| `Select` | Dropdowns, filters |
| `Toast` | Success/error notifications |
| `Skeleton` | Loading states |
| `Chart` | Compliance trends |
| `File_Upload` | PDF/CSV/JSON upload |

**Installation:**
```bash
npx shadcn@latest init
npx shadcn@latest add button card table badge dialog input select toast skeleton chart
```

---

## Recommended Project Structure

```
/app
  /api
    /policies
      /ingest/route.ts      # PDF upload + rule extraction
      /[id]/route.ts        # Get policy
      /[id]/clarify/route.ts # Clarification questions
    /data
      /upload/route.ts      # CSV/JSON upload
      /airtable/route.ts   # Airtable connection
    /scan
      /run/route.ts        # Run compliance scan
      /rescan/route.ts     # Rescan with diff
    /violations
      /route.ts             # List violations
      /[id]/route.ts       # Get/update violation
    /export/route.ts       # Export report
  /dashboard/page.tsx      # Main dashboard
  /policy/page.tsx         # Policy upload/selection
  /data/page.tsx           # Data upload/connection
  /violations/page.tsx    # Violations list
  /history/page.tsx        # Scan history + trends

/components
  /ui                     # shadcn components (Button, Card, etc.)
  /dashboard
    /ScoreCard.tsx
    /TrendsChart.tsx
  /policy
    /UploadZone.tsx
    /RulesList.tsx
    /ClarificationQuestions.tsx
  /violations
    /Table.tsx
    /DetailDrawer.tsx

/lib
  /validators              # Zod schemas
    /policy.ts
    /violation.ts
    /scan.ts
  /services
    /gemini.ts            # LLM integration
    /unpdf.ts             # PDF parsing
    /supabase.ts          # DB client
  /utils.ts

/types
  /index.ts               # TypeScript interfaces
```

---

## Implementation Priority

### Day 0: Project Setup (30 minutes)

```bash
# Initialize Next.js
npx create-next-app@latest yggdrasil --typescript --tailwind --eslint
cd yggdrasil

# Install core packages
npm install zod @vercel/ai @google/generative-ai unpdf

# Setup shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card table badge dialog input select toast skeleton chart form label
```

### Day 1: Core Features (Hours 0-8)

1. **Hours 0-2:** PDF parsing with unpdf + Gemini rule extraction
2. **Hours 2-4:** Data upload (CSV/JSON/Airtable)
3. **Hours 4-6:** Scan engine + violation detection
4. **Hours 6-8:** Dashboard + violations UI

### Day 2: Polish (Hours 8-18)

1. Clarification questions
2. Human review layer
3. Export functionality
4. Trends visualization

---

## Related Documentation

- [LLMSystemPrompts.md](./LLMSystemPrompts.md)
- [ClarificationQuestions.md](./ClarificationQuestions.md)
- [PeriodicMonitoring.md](./PeriodicMonitoring.md)
- [meta/Setup.md](./meta/Setup.md)
