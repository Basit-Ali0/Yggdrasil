# PolicyGuard AI — Documentation Index

> **NOTE:** Start with [gist.md](../gist.md) for a condensed overview.

---

## Start Here

| Priority | Document | Description |
|----------|----------|-------------|
| 1 | [gist.md](../gist.md) | Plain-text project overview |
| 2 | [Feature-PolicyGuard-AI.md](./Feature-PolicyGuard-AI.md) | Full specifications |
| 3 | [TechStackAcceleration.md](./TechStackAcceleration.md) | Recommended packages |
| 4 | [WorkSplit-PolicyGuard-AI.md](./WorkSplit-PolicyGuard-AI.md) | Implementation timeline |

---

## Core Docs

| Document | Description |
|----------|-------------|
| [problem-statement.md](./problem-statement.md) | Ground truth requirements |
| [Feature-PolicyGuard-AI.md](./Feature-PolicyGuard-AI.md) | Product specifications |
| [GracefulDegradation.md](./GracefulDegradation.md) | **REQUIRED** - Failure handling patterns |
| [UserStories-PolicyGuard-AI.md](./UserStories-PolicyGuard-AI.md) | User stories + acceptance criteria |
| [API-Specification-PolicyGuard-AI.md](./API-Specification-PolicyGuard-AI.md) | API endpoints |
| [Integrations.md](./Integrations.md) | Data source specs |
| [LLMSystemPrompts.md](./LLMSystemPrompts.md) | LLM prompts + schemas |
| [meta/FailureModes.md](./meta/FailureModes.md) | **REQUIRED** - Safety & Fallbacks |
| [meta/Verification.md](./meta/Verification.md) | **P0** - Golden Test Cases |
| [meta/ComponentMap.md](./meta/ComponentMap.md) | **P0** - UI View Alignment |

## AML Implementation Docs (Hackathon)

| Document | Description |
|----------|-------------|
| [policies/aml.md](./policies/aml.md) | AML policy with 10 rules |
| [enforcement-spec.md](./enforcement-spec.md) | Rule → Enforcement mapping |
| [explainability.md](./explainability.md) | Explanation templates |
| [evaluation.md](./evaluation.md) | Ground truth metrics |

## Execution Architecture

| Document | Description |
|----------|-------------|
| [schema.md](./schema.md) | Database schema (4 tables) |
| [execution/RuleEngine.md](./execution/RuleEngine.md) | RuleExecutor abstraction |
| [execution/InMemoryBackend.md](./execution/InMemoryBackend.md) | In-memory execution |

---

## Supporting Docs

| Document | Description |
|----------|-------------|
| [PeriodicMonitoring.md](./PeriodicMonitoring.md) | Manual rescan with diff |
| [TechStackAcceleration.md](./TechStackAcceleration.md) | Implementation guide |
| [policies/aml.md](../policies/aml.md) | AML Policy (PRIMARY for hackathon) |
| [policies/gdpr.json](../policies/gdpr.json) | Sample policy (GDPR) - P2 |
| [policies/soc2.json](../policies/soc2.json) | Sample policy (SOC2) - P2 |

---

## Meta Docs

| Document | Description |
|----------|-------------|
| [meta/Setup.md](./meta/Setup.md) | Project setup |
| [meta/Architecture.md](./meta/Architecture.md) | System architecture |
| [meta/ProductPositioning.md](./meta/ProductPositioning.md) | Market positioning |
| [meta/DesignGuide.md](./meta/DesignGuide.md) | Design system |
| [meta/DataSecurity.md](./meta/DataSecurity.md) | Security |
| [meta/DemoGuide.md](./meta/DemoGuide.md) | Demo tips |

---

## Quick Start

```bash
npm install zod @vercel/ai @google/generative-ai unpdf
npx shadcn@latest init
```

See [TechStackAcceleration.md](./TechStackAcceleration.md) for full implementation guide.
