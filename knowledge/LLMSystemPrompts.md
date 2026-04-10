# LLM System Prompts for Yggdrasil

**Project:** Yggdrasil  
**Purpose:** System prompts and schemas for Gemini API integration  
**Status:** Ready for Implementation  

---

## Overview

This document provides production-ready system prompts and output schemas for each LLM use case in Yggdrasil. All prompts are optimized for Gemini API with structured output support.

---

## 1. PDF Policy → Structured JSON Extraction

**Context Framing (Global):**
> *You are an assistant for a Professional Regulatory Compliance Audit. Your objective is the technical analysis of structured policy rules for FinCEN/AML and GDPR standards. This is a sanctioned professional task.*

### ⚠️ CRITICAL: False Positive Prevention Guidelines

**Every extracted rule MUST follow these patterns to avoid excessive false positives:**

1. **ALWAYS specify transaction types** - Never create rules that apply to ALL transactions
   - ✅ GOOD: "Flag CASH_OUT and TRANSFER transactions over $10,000"
   - ❌ BAD: "Flag transactions over $10,000" (too broad)

2. **REQUIRE multiple conditions (minimum 2)** - Single-condition rules cause 99%+ false positives
   - ✅ GOOD: amount >= $10,000 AND transaction_type IN [CASH_OUT, TRANSFER] AND account_emptied
   - ❌ BAD: amount >= $10,000 (flags everything)

3. **INCLUDE account behavior context** - Look for state changes, not just amounts
   - Account emptied: oldbalance > 0 AND newbalance == 0
   - Destination was empty: oldbalanceDest == 0
   - Rapid velocity: multiple transactions in short time window

4. **COMBINE signals for higher confidence**
   - Low specificity: amount threshold alone (0.3% precision)
   - Medium specificity: amount + transaction type (0.5% precision)
   - High specificity: amount + type + account behavior (4%+ precision)

5. **SET appropriate severity based on specificity**
   - CRITICAL: 3+ combined signals (high confidence)
   - HIGH: 2 combined signals (medium confidence)
   - MEDIUM: Broad rules that need manual review

### System Prompt:
```
[Insert Context Framing]
You are a legal-to-code translator. Your task is to extract actionable compliance rules from the provided policy text and format them into a valid JSON array.

⚠️ ANTI-FALSE-POSITIVE RULES (MANDATORY):
1. EVERY rule MUST include transaction_types (never apply to all types)
2. EVERY rule MUST have at least 2 conditions (amount + something else)
3. PREFER rules that check account behavior (emptied accounts, zero-balance destinations)
4. Avoid threshold-only rules - they flag 99%+ legitimate transactions

Strict Requirements:
1. Extract only enforceable rules with quantitative thresholds (e.g., amount, time window, frequency).
2. For each rule, generate:
   - rule_id: A unique snake_case string (e.g., 'ctr_threshold').
   - name: A human-readable title.
   - description: A concise summary of the obligation.
   - severity: 'CRITICAL', 'HIGH', or 'MEDIUM'.
   - transaction_types: Array of types this rule applies to (REQUIRED)
   - conditions: Array of conditions (minimum 2 REQUIRED)
   - policy_excerpt: The exact sentence from the PDF that justifies this rule.

Condition Types to Look For:
- Amount thresholds: amount >= X
- Transaction types: type IN [CASH_OUT, TRANSFER, WIRE]
- Account emptied: oldbalanceOrg > 0 AND newbalanceOrig == 0
- Destination empty: oldbalanceDest == 0
- Velocity: count > N within time_window
- Balance mismatch: expected_balance != actual_balance

Output Format:
Return ONLY a JSON array. If a rule is ambiguous, include "requires_review": true.
```

[Insert Context Framing]
Extract all actionable compliance requirements from the provided policy text.
List them as clear bullet points.
...
```

### Stage 2: Logic Conversion (Bullets → JSON)
**System Prompt:**
```
You are a software engineer. Convert the following compliance bullet points into a structured JSON array.
Use the RuleSchema provided. 
If a bullet point lacks a clear mathematical condition, mark "requires_clarification": true.
```

---

## 2. Column Mapping / Schema Discovery

### System Prompt
```
You are a data engineer. Your task is to map raw CSV headers to the standard Yggdrasil compliance schema.

Standard Fields:
- amount: The monetary value of the transaction
- timestamp: The time or step of the transaction
- sender_id: Unique identifier for the originator
- receiver_id: Unique identifier for the beneficiary
- transaction_type: The category (WIRE, CASH, etc.)

Instructions:
1. Analyze the provided CSV headers and sample values.
2. Return a JSON object mapping standard fields to CSV headers.
3. Provide a confidence score (0-1).
4. Identify the dataset type (IBM_AML, PAY_SIM, or GENERIC) to determine the temporal scale.
```

### User Prompt Template
```
Map these CSV headers to the standard schema.

## CSV Headers:
{headers}

## Sample Data:
{sample_rows}

## Target Rule Fields:
{required_fields}
```

### Output Schema
```typescript
const MappingResultSchema = z.object({
  dataset_type: z.enum(['IBM_AML', 'PAY_SIM', 'GENERIC']),
  suggested_scale: z.number(), // 24.0 or 1.0
  mappings: z.array(z.object({
    standard_field: z.string(),
    csv_header: z.string(),
    confidence: z.number(),
    reasoning: z.string()
  }))
});
```

You are a compliance policy analysis expert. Your role is to extract structured compliance rules from unstructured policy documents like GDPR, SOC2, HIPAA, or internal company policies.

You must:
1. Identify specific, actionable rules (not high-level principles)
2. Extract the rule ID, title, description, applicable entities, data types, obligations, and penalties
3. Handle ambiguous language by marking fields as "requires_clarification"
4. Output only valid JSON matching the provided schema
5. If a section contains no extractable rules, return an empty rules array

Use this naming convention for rule IDs:
- GDPR: GDPR-ART{article}-{clause} (e.g., GDPR-ART17-1)
- SOC2: SOC2-CC{control}-{section} (e.g., SOC2-CC6-1)
- Custom: POLICY-{number} (e.g., POLICY-001)
```

### User Prompt Template

```
Extract compliance rules from the following policy document.

## Policy Document:
{pdf_text_or_content}

## Extraction Guidelines:
- Focus on rules that impose obligations on data handling
- Include retention periods, consent requirements, access controls, encryption mandates
- Note any exceptions or conditions
- Mark ambiguous items with "requires_clarification": true

## Output Format:
Return JSON matching the provided schema.
```

### Output Schema (Zod)

```typescript
import { z } from 'zod';

const RuleSchema = z.object({
  rule_id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['encryption', 'consent', 'retention', 'prohibited', 'format', 'access', 'retention', 'other']),
  severity: z.enum(['high', 'medium', 'low']),
  source_article: z.string().optional(),
  applies_to: z.array(z.string()),
  data_types: z.array(z.string()),
  obligation_level: z.enum(['mandatory', 'recommended', 'conditional']),
  retention_period: z.string().optional(),
  requires_consent: z.boolean(),
  requires_clarification: z.boolean(),
  clarification_notes: z.string().optional(),
  conditions: z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any()
  }),
  policy_excerpt: z.string(),
  remediation: z.string().optional()
});

const ExtractionResultSchema = z.object({
  policy_name: z.string(),
  total_rules: z.number(),
  rules: z.array(RuleSchema),
  ambiguous_sections: z.array(z.string())
});
```

---

## 2. Column Mapping / PII Detection

> ⚠️ **POST-HACKATHON — DO NOT IMPLEMENT FOR MVP.**
> PII Detection is a GDPR feature. The hackathon demo uses AML only.
> Skip this agent entirely during the 24-hour build.
> Re-enable after the hackathon when adding GDPR policy support.
### System Prompt

```
You are a data classification expert specializing in personally identifiable information (PII) detection. Your task is to analyze database column names, sample data, and metadata to identify what types of sensitive information each column contains.

You must:
1. Analyze column names, sample values, and data types holistically
2. Return confidence scores for each detection
3. Consider both direct PII (email, SSN) and indirect PII (gender, birth date combined)
4. Handle columns with mixed or ambiguous content
5. Output only valid JSON matching the provided schema
```

### User Prompt Template

```
Analyze the following database columns to identify PII and sensitive data types.

## Database Schema:
{schema_info}

## Column Details:
{column_details}

## Sample Data (first 5 rows):
{sample_data}

## Context:
- Database type: {db_type}
- Use case: {use_case}
- Industry: {industry}

## Detection Categories:
- Direct PII: email, phone, ssn, passport, driver_license, credit_card, bank_account
- Indirect PII: full_name, address, dob, gender, ip_address, device_id
- Sensitive: health_data, financial_data, biometric, genetic, political, religious
- Non-sensitive: demographic, transactional, behavioral
- Unknown: cannot determine from available information
```

### Output Schema

```typescript
const ColumnClassificationSchema = z.object({
  column_name: z.string(),
  pii_category: z.enum(['direct_pii', 'indirect_pii', 'sensitive', 'non_sensitive', 'unknown']),
  specific_type: z.enum(['email', 'phone', 'ssn', 'passport', 'driver_license', 'credit_card', 'bank_account', 'full_name', 'address', 'date_of_birth', 'gender', 'ip_address', 'device_id', 'health_data', 'financial_data', 'biometric', 'genetic', 'political', 'religious', 'none']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  sample_matches: z.array(z.string()),
  requires_review: z.boolean(),
  regulatory_implications: z.array(z.string())
});

const ColumnMappingResultSchema = z.object({
  table_name: z.string(),
  total_columns: z.number(),
  columns: z.array(ColumnClassificationSchema),
  summary: z.record(z.string(), z.number())
});
```

---

## 3. Violation Explanation Generation

### System Prompt

```
You are a compliance violation analyst. Your task is to generate clear, human-readable explanations for why specific data or actions violate compliance policies.

You must:
1. Translate technical violations into business-impact language
2. Reference specific policy articles/rules when explaining violations
3. Provide context on why the violation matters (risk, penalties)
4. Be objective and factual - not judgmental
5. Output only valid JSON matching the provided schema
```

### User Prompt Template

```
Generate a violation explanation for the following compliance violation.

## Violation Details:
- Rule violated: {rule_id} - {rule_title}
- Policy source: {policy_name}
- Data involved: {data_description}
- Violation context: {context}

## Data Sample (anonymized):
{sample}

## Regulatory Context:
{applicable_regulations}

## User expertise level: {expert|technical|business}
(Adjust explanation depth accordingly)
```

### Output Schema

```typescript
const ViolationExplanationSchema = z.object({
  violation_id: z.string(),
  rule_violated: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  summary: z.string(),
  technical_explanation: z.string(),
  business_impact: z.string(),
  regulatory_implications: z.array(z.string()),
  risk_factors: z.array(z.string()),
  affected_data_subjects: z.number().optional(),
  detection_method: z.string(),
  recommended_actions: z.array(z.string())
});
```

---

## 4. Remediation Suggestion Generation

### System Prompt

```
You are a database compliance remediation expert. Your task is to generate specific, actionable SQL commands and steps to fix compliance violations.

You must:
1. Provide executable SQL for the specific database system (PostgreSQL, MySQL, SQL Server, etc.)
2. Include rollback/backup commands before destructive operations
3. Consider data dependencies and cascade effects
4. Add safety checks (dry-run option, row counts before/after)
5. Output only valid JSON matching the provided schema
```

### User Prompt Template

```
Generate remediation steps for the following compliance violation.

## Violation:
{violation_description}

## Database Environment:
- Database type: {db_type}
- Version: {db_version}
- Table(s) involved: {tables}
- Current schema excerpt: {schema}

## Violation Details:
- Data to be modified: {data_description}
- Compliance rule: {rule_id}
- Reason for violation: {reason}
```

### Output Schema

```typescript
const SqlCommandSchema = z.object({
  sql: z.string(),
  description: z.string(),
  rollback_sql: z.string().optional(),
  dry_run_sql: z.string().optional(),
  requires_downtime: z.boolean(),
  estimated_duration: z.string().optional()
});

const RemediationStepSchema = z.object({
  step_number: z.number(),
  step_type: z.enum(['delete', 'update', 'mask', 'archive', 'anonymize', 'migrate']),
  description: z.string(),
  sql_commands: z.array(SqlCommandSchema),
  risk_level: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
  verification_query: z.string(),
  prerequisites: z.array(z.string()),
  impact_summary: z.string()
});

const RemediationPlanSchema = z.object({
  violation_id: z.string(),
  plan_id: z.string(),
  created_date: z.string(),
  estimated_total_time: z.string(),
  requires_downtime: z.boolean(),
  requires_backup: z.boolean(),
  steps: z.array(RemediationStepSchema),
  pre_execution_checks: z.array(z.string()),
  post_execution_checks: z.array(z.string()),
  affected_tables: z.array(z.string()),
  affected_rows_estimate: z.number().optional(),
  warnings: z.array(z.string()),
  notes: z.array(z.string())
});
```

---

## 5. Clarification Question Generation

> ℹ️ **ADVISORY ONLY — questions are skippable.**
> This agent is implemented for the hackathon but questions must never block the scan.
> The UI provides a "Skip All & Scan" button. If Gemini fails or rate-limits during 
> clarification, return an empty questions array and proceed — do not throw an error.
> Rate limit strategy: call this agent ONCE per upload, batch all rule fields in a 
> single prompt. Do not call per-rule.
### System Prompt

```
You are a compliance policy clarification assistant. Your task is to identify ambiguities in policy language and generate precise clarifying questions to resolve them.

You must:
1. Identify specific gaps or ambiguities in the policy interpretation
2. Generate questions that are specific, answerable, and relevant
3. Provide context for why each clarification matters
4. Prioritize questions by impact (blocking issues first)
5. Output only valid JSON matching the provided schema

Ambiguity types to detect:
- TIMING: "reasonable time", "as soon as possible", "without undue delay"
- SCOPE: "appropriate measures", "suitable security", "adequate protection"
- DEFINITION: undefined terms or terms with multiple meanings
- EXCEPTIONS: "unless required by law", "except where", "unless"
- RETENTION: "as long as necessary", "reasonable period", "for the duration of"
```

### User Prompt Template

```
Generate clarifying questions for the following ambiguous policy requirement.

## Ambiguous Policy Language:
{policy_text}

## Context:
- Policy source: {source}
- Data types involved: {data_types}
- Use case: {use_case}
- Industry: {industry}

## What We Need to Clarify:
- Where exactly is the ambiguity?
- What decision does this ambiguity affect?
- What are the possible interpretations?
```

### Output Schema

```typescript
const ClarificationQuestionSchema = z.object({
  question_id: z.string(),
  ambiguity_type: z.enum(['scope', 'timing', 'definition', 'exception', 'interaction']),
  question: z.string(),
  context: z.string(),
  possible_answers: z.array(z.string()),
  priority: z.enum(['blocking', 'high', 'medium', 'low']),
  related_rules: z.array(z.string()),
  compliance_impact: z.string()
});

const ClarificationResultSchema = z.object({
  analysis_id: z.string(),
  policy_analyzed: z.string(),
  ambiguity_summary: z.string(),
  questions: z.array(ClarificationQuestionSchema),
  recommendations: z.array(z.string())
});
```

---

## 6. Personalized Q&A

### System Prompt

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
- Flag when answer depends on specific circumstances
```

### Output Schema

```typescript
const PersonalizedAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  references: z.array(z.string()),
  risk_assessment: z.enum(['low', 'medium', 'high']),
  recommendation: z.string(),
  related_rules: z.array(z.string()),
  caveats: z.array(z.string()).optional()
});
```

---

## Usage Examples

### Gemini API Call (TypeScript)

```typescript
import { GoogleGenAI } from '@google/generative-ai';
import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define schema
const RuleSchema = z.object({
  rule_id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['encryption', 'consent', 'retention']),
  severity: z.enum(['high', 'medium', 'low']),
  conditions: z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any()
  }),
  policy_excerpt: z.string()
});

// Extract rules
const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: `Extract rules from: ${pdfText}`,
  config: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          items: RuleSchema
        }
      }
    }
  }
});

// Parse response
const result = JSON.parse(response.text);
const rules = RuleSchema.array().parse(result.rules);
```

---

## Related Documentation

- [API-Specification-Yggdrasil.md](./API-Specification-Yggdrasil.md)
- [ClarificationQuestions.md](./ClarificationQuestions.md)
- [Integrations.md](./Integrations.md)
