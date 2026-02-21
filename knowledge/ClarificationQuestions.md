# User Story: Clarification Questions

> **⚠️ DEPRECATED:** User stories have been merged into [UserStories-PolicyGuard-AI.md](./UserStories-PolicyGuard-AI.md). Technical prompts are in [LLMSystemPrompts.md](./LLMSystemPrompts.md).
>
> **Reason:** User stories consolidated into UserStories doc. Technical content in LLMSystemPrompts.

**Project:** PolicyGuard AI  
**Feature:** Clarification Questions for Ambiguous Policy Language  
**Status:** Ready for Implementation  

---

## Problem Statement

When extracting rules from PDF policies, the LLM often encounters ambiguous language that cannot be resolved without human context. For example:

- "Personal data must be deleted within a reasonable time" — What is "reasonable"?
- "Appropriate security measures must be implemented" — What qualifies as "appropriate"?
- "Data should be retained as long as necessary" — How long is "necessary"?

Without clarification, the extracted rules are generic and not actionable. Users need the ability to:

1. Have the LLM ask clarifying questions when it detects ambiguity
2. Answer those questions to refine the extracted rules
3. Get personalized, context-aware compliance rules

---

## User Story: US-CLAR-01

**As a** user uploading a PDF policy,  
**I want** the system to ask me clarifying questions when policy language is ambiguous,  
**So that** the extracted rules are specific to my organization's context and actually actionable.

### Acceptance Criteria

- [ ] When policy contains ambiguous language, LLM generates 1-5 clarification questions
- [ ] Questions are displayed to user BEFORE rules are finalized
- [ ] Each question has context explaining why clarification matters
- [ ] User can answer questions with free text or select from options
- [ ] After answering, rules are regenerated with the user's context
- [ ] User can skip questions and accept generic rules

### User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  PDF Uploaded + Rules Extracted                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠️ Policy contains ambiguous language              │   │
│  │                                                      │   │
│  │ Before we finalize your rules, we need clarity on:  │   │
│  │                                                      │   │
│  │ 1. [Q] What does "reasonable time" mean for       │   │
│  │      data deletion in your organization?           │   │
│  │      → Context: GDPR requires specific timeframes  │   │
│  │      [30 days] [60 days] [90 days] [Other: ___]   │   │
│  │                                                      │   │
│  │ 2. [Q] How do you handle deleted user data?        │   │
│  │      → Context: Soft delete vs hard delete affects │   │
│  │         rule implementation                        │   │
│  │      [Soft delete] [Hard delete] [Varies]         │   │
│  │                                                      │   │
│  │ [Skip Questions]  [Submit Answers]                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## User Story: US-CLAR-02

**As a** user,  
**I want** to be able to ask my own clarifying questions about the extracted rules,  
**So that** I can get personalized guidance that addresses my specific concerns.

### The "Personalized Help" Use Case

Sometimes the default rules (even after clarification) aren't personalized enough for the user's situation. The user should be able to ask follow-up questions:

**Example Scenario:**
> User: "The rules say I need consent for email marketing. But what about existing customers who already gave implicit consent by making a purchase? Do I need fresh consent for each category of marketing?"

**Response should include:**
- Specific answer based on GDPR/regulations
- Risk assessment for each approach
- Recommended action with reasoning
- References to relevant articles/recitals

### Acceptance Criteria

- [ ] User can click "Ask a question" on any rule
- [ ] Free-text input for question submission
- [ ] LLM generates context-aware answer within 5 seconds
- [ ] Answer includes regulatory basis (Article/Recital references)
- [ ] Answer includes risk assessment and recommendation
- [ ] Question and answer are stored for audit trail

### User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Rules Display                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ GDPR-002: Consent Required                          │   │
│  │ "Explicit consent required before processing       │   │
│  │  personal data for marketing purposes"             │   │
│  │                                                      │   │
│  │ [View Details] [Ask Question] [Edit]              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Ask Question Modal                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ask about this rule:                                │   │
│  │                                                      │   │
│  │ "What about existing customers who made purchases? │   │
│  │ Do I need fresh consent for each marketing          │   │
│  │ category?"                                          │   │
│  │                                                      │   │
│  │ [Cancel] [Submit Question]                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Answer Display                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ Answer                                             │   │
│  │                                                      │   │
│  │ Based on GDPR Article 6(1)(a) and Recital 32,     │   │
│  │ existing customers who made a purchase have given   │   │
│  │ implicit consent for communications related to      │   │
│  │ that transaction. However:                          │   │
│  │                                                      │   │
│  │ ✓ You need SEPARATE consent for:                    │   │
│  │    • Marketing emails about new products            │   │
│  │    • Third-party marketing                          │   │
│  │    • Cross-selling different categories             │   │
│  │                                                      │   │
│  │ ✓ You CAN likely rely on legitimate interest for:   │   │
│  │    • Service announcements (not marketing)          │   │
│  │    • Product updates for purchased items            │   │
│  │                                                      │   │
│  │ ⚠️ Risk Assessment: Medium                          │   │
│  │    Recommend: Get explicit consent for any          │   │
│  │    marketing to avoid complaints.                   │   │
│  │                                                      │   │
│  │ [Ask Another Question] [Close]                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### System Prompt for Clarification Generation

```
You are a compliance policy analysis expert. When extracting rules from policy documents, identify ambiguities that require human context.

For each ambiguity:
1. Generate a specific, answerable question
2. Provide context explaining why the answer matters
3. Suggest answer options when possible
4. Prioritize questions by impact (blocking > high > medium > low)

Ambiguity types to detect:
- TIMING: "reasonable time", "as soon as possible", etc.
- SCOPE: "appropriate measures", "suitable security", etc.
- DEFINITION: "personal data", "consent", etc. (when undefined)
- EXCEPTIONS: "unless required by law", "except where", etc.
- RETENTION: "as long as necessary", "reasonable period", etc.

Output format: JSON array of questions with priority and context.
```

### System Prompt for Personalized Q&A

```
You are a compliance advisor helping organizations understand and implement GDPR/privacy requirements.

When answering user questions:
1. Provide specific, actionable advice
2. Reference relevant regulations by Article/Recital number
3. Include risk assessment (low/medium/high)
4. Give clear recommendations with reasoning
5. Note when there are multiple valid approaches

Always:
- Lead with the answer, then explain
- Use plain language, avoid jargon
- Include specific examples when helpful
- Note regional variations if relevant
```

### API Endpoints

#### POST /api/policies/:id/clarify

Generate clarification questions for ambiguous policy.

**Response:**

```json
{
  "questions": [
    {
      "id": "clar_001",
      "type": "timing",
      "question": "What does 'reasonable time' mean for data deletion in your organization?",
      "context": "GDPR Article 17 requires erasure 'without undue delay' but allows for specific timeframes. Your policy mentions 'reasonable time' which needs definition.",
      "options": ["30 days", "60 days", "90 days", "Other"],
      "priority": "blocking",
      "affects_rules": ["gdpr_retention_001", "gdpr_erasure_001"]
    }
  ]
}
```

#### POST /api/policies/:id/clarify/:questionId/answer

Submit answer to a clarification question.

**Request:**

```json
{
  "answer": "60 days",
  "custom_answer": null
}
```

#### POST /api/rules/:ruleId/question

Ask a personalized question about a specific rule.

**Request:**

```json
{
  "question": "What about existing customers who already gave implicit consent?"
}
```

**Response:**

```json
{
  "answer": "Based on GDPR Article 6(1)(a)...",
  "references": ["Article 6(1)(a)", "Recital 32"],
  "risk_assessment": "medium",
  "recommendation": "Get separate consent for marketing...",
  "related_rules": ["gdpr_consent_001", "gdpr_marketing_001"]
}
```

---

## LLM Integration Research

See [LLMSystemPrompts.md](./LLMSystemPrompts.md) for detailed system prompts and output schemas for:

1. PDF Policy → Structured Rules Extraction
2. Column Mapping / PII Detection
3. Violation Explanation Generation
4. Remediation Suggestion Generation
5. Clarification Question Generation (detailed)
6. Compliance Score Explanation

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Clarification questions generated per ambiguous policy | 1-5 |
| User completion rate for clarification flow | >70% |
| Personalized Q&A response time | <5 seconds |
| Answer accuracy (regulatory basis) | >90% |
| User satisfaction with personalized help | >4/5 |

---

## Related Documentation

- [API-Specification-PolicyGuard-AI.md](./API-Specification-PolicyGuard-AI.md)
- [LLMSystemPrompts.md](./LLMSystemPrompts.md)
- [Integrations.md](./Integrations.md)
- [PeriodicMonitoring.md](./PeriodicMonitoring.md)
