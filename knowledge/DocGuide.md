# Documentation Guide: PolicyGuard AI

**Purpose:** Guidelines for writing and maintaining documentation  

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../../gist.md). That file contains a plain-text summary of the entire project context.

---

## Why This Guide Exists

This project uses a **lean documentation approach**. The goal is maximum clarity with minimum redundancy. Before writing something new, check if it already exists. After writing, ensure cross-references are updated.

---

## Before You Write

### Check Existing Docs First

| What You Need | Where to Look |
|---------------|---------------|
| Project overview | [gist.md](../gist.md) |
| Data source integrations | [Integrations.md](./Integrations.md) |
| User stories | [UserStories-PolicyGuard-AI.md](./UserStories-PolicyGuard-AI.md) |
| API specs | [API-Specification-PolicyGuard-AI.md](./API-Specification-PolicyGuard-AI.md) |
| Implementation timeline | [WorkSplit-PolicyGuard-AI.md](./WorkSplit-PolicyGuard-AI.md) |
| Architecture | [meta/Architecture.md](./meta/Architecture.md) |

### Decision Tree: Do You Need a New Doc?

```
Is the information already in an existing doc?
├── Yes → Add cross-reference, do NOT duplicate
└── No
    ├── Is it a small detail (<10 lines)?
    │   ├── Yes → Add to existing doc as section
    │   └── No
    │       ├── Is it a new feature/capability?
    │       │   ├── Yes → Create new doc + update all refs
    │       │   └── No
    │       │       └── Is it meta-documentation (how-to)?
    │       │           ├── Yes → Add to this guide
    │       │           └── No → Add to appropriate existing doc
```

---

## Required Elements for Every Doc

Every new document MUST include:

### 1. LLM Reference Note (Top of Doc)

```markdown
> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [gist.md](../gist.md). That file contains a plain-text summary of the entire project context.
```

### 2. Related Docs Section

At the end or near the top, add:

```markdown
**Related Docs:**
- [gist.md](../gist.md) - Condensed overview
- [WorkSplit-PolicyGuard-AI.md](./WorkSplit-PolicyGuard-AI.md) - Timeline
- [Integrations.md](./Integrations.md) - (if applicable)
```

---

## Document Types and Where They Go

### Strategic/Overview Docs
- **Brief-*.md** — Problem, solution, value proposition
- **PRFAQ-*.md** — Press release, validation
- Goes in: `/docs/`

### Technical Docs
- **API-Specification-*.md** — API endpoints
- **Integrations.md** — Data source integrations
- Goes in: `/docs/`

### Implementation Docs
- **WorkSplit-*.md** — Timeline, tasks
- **UserStories-*.md** — Requirements
- Goes in: `/docs/`

### Meta Docs
- **meta/*.md** — Architecture, setup, design, etc.
- Goes in: `/docs/meta/`

---

## Writing Guidelines

### Be Concise

- Prefer bullet points over paragraphs
- Use tables for structured data
- Include code snippets for technical content

### Cross-Reference Everything

Every time you mention something that has its own doc, link to it:

```markdown
- See [Integrations.md](./Integrations.md) for CSV/JSON/Airtable setup
- Rule schema defined in [PRFAQ-PolicyGuard-AI.md](./PRFAQ-PolicyGuard-AI.md)
```

### Keep gist.md Updated

When you add new knowledge that changes the project:

1. Update **gist.md** with the new information (condensed)
2. The gist is the single source of truth for LLMs

### Update README Index

When adding a new doc:
1. Add to README.md Documentation Overview table
2. Add to Quick Start or Full Reading list if important
3. Ensure it's linked from related docs

---

## Checklist: After Writing a New Doc

- [ ] Added LLM reference note at top
- [ ] Added Related Docs section with links
- [ ] Updated gist.md with condensed info
- [ ] Updated README.md index table
- [ ] Linked from at least 2 other existing docs
- [ ] Verified all links work (relative paths correct)

---

## Example: Adding a New Integration

Say you want to add "Google Sheets" as a data source:

1. **Check** — Is it already in Integrations.md? No
2. **Update Integrations.md** — Add Google Sheets section (don't create new doc for a single integration)
3. **Update gist.md** — Add "Google Sheets" to data sources list
4. **Update README.md** — Add Integrations.md reference in relevant sections
5. **Update UserStories.md** — Add US-5d for Google Sheets if needed
6. **Update WorkSplit.md** — Add hour estimate if implementation planned

---

## File Naming Conventions

- Use kebab-case: `Integrations.md`, not `integrations.md`
- Prefix meta docs with category: `meta/Architecture.md`, `meta/Setup.md`
- Main docs: `Brief-*.md`, `PRFAQ-*.md`, `WorkSplit-*.md`, `UserStories-*.md`

---

## Questions?

If you're unsure where something goes or whether it needs a new doc, check:
1. [gist.md](../gist.md) — Understand the project structure
2. This guide — Determine doc placement
3. Ask the team — When in doubt, discuss before creating
