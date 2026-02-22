// ============================================================
// POST /api/violations/[id]/remediation — Generate Fix
// Uses Gemini to produce actionable remediation steps
// Cached by rule_id to avoid redundant API calls
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, AuthError } from '@/lib/supabase';
import { geminiGenerateObject } from '@/lib/gemini';
import { z } from 'zod';
import type { Remediation } from '@/lib/types';

// ── In-memory cache by rule_id ──────────────────────────────
const remediationCache = new Map<string, Remediation>();

// ── AML rule patterns (no programmatic fix possible) ────────
const AML_RULE_PATTERNS = [
    'CTR_', 'SAR_', 'STRUCTURING', 'VELOCITY', 'DORMANT',
    'ROUND_AMOUNT', 'HIGH_RISK', 'RAPID_MOVEMENT', 'SUB_THRESHOLD',
    'SMURFING',
];

function isAmlRule(ruleId: string): boolean {
    const upper = ruleId.toUpperCase();
    return AML_RULE_PATTERNS.some(p => upper.includes(p));
}

// ── Zod schema for Gemini structured output ─────────────────
const RemediationStepSchema = z.object({
    title: z.string(),
    code: z.string(),
    language: z.enum(['sql', 'typescript', 'python', 'bash', 'terraform', 'text']),
});

const RemediationSchema = z.object({
    summary: z.string(),
    steps: z.array(RemediationStepSchema),
    estimated_effort: z.string(),
    risk_level: z.enum(['low', 'medium', 'high']),
    applicable_frameworks: z.array(z.string()),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await getSupabaseForRequest(request);

        // 1. Fetch the violation
        const { data: violation, error } = await supabase
            .from('violations')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !violation) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Violation not found' },
                { status: 404 }
            );
        }

        // 2. Block AML violations — no programmatic fix
        if (isAmlRule(violation.rule_id)) {
            return NextResponse.json(
                {
                    error: 'NOT_APPLICABLE',
                    message: 'Remediation generation is not available for AML violations. AML violations require human review and regulatory reporting, not code fixes.',
                },
                { status: 400 }
            );
        }

        // 3. Check cache by rule_id
        const cacheKey = violation.rule_id;
        const cached = remediationCache.get(cacheKey);
        if (cached) {
            console.log(`[remediation] Cache hit for rule_id=${cacheKey}`);
            return NextResponse.json(cached);
        }

        // 4. Build Gemini prompt
        const systemPrompt = `You are a compliance remediation engineer. Given a compliance violation, generate specific, actionable remediation steps with working code snippets.

Your output should be practical, copy-pasteable code that an engineer can implement immediately. Think about:
- Database schema changes (SQL)
- Application code fixes (TypeScript/Python)
- Infrastructure configuration (Terraform/Bash)
- Policy or documentation changes (text)

Be specific and concrete. Avoid vague advice like "implement encryption" — instead provide the exact SQL ALTER TABLE statement or the exact code snippet.

Each step should have a clear title and a single code block. Choose the most appropriate language for each step.`;

        const evidenceSummary = violation.evidence
            ? Object.entries(violation.evidence)
                .slice(0, 10)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')
            : 'No evidence data available';

        const userPrompt = `Generate remediation steps for the following compliance violation:

**Rule:** ${violation.rule_name} (${violation.rule_id})
**Severity:** ${violation.severity}
**Policy Excerpt:** ${violation.policy_excerpt || 'N/A'}
**Policy Section:** ${violation.policy_section || 'N/A'}
**Explanation:** ${violation.explanation || 'N/A'}

**Transaction Context:**
Account: ${violation.account}
Amount: ${violation.amount}
Type: ${violation.transaction_type || 'N/A'}

**Evidence Data:**
${evidenceSummary}

Generate 2-4 concrete remediation steps with code. Focus on the most impactful fixes first.`;

        // 5. Call Gemini
        console.log(`[remediation] Generating fix for rule_id=${cacheKey}`);
        const result = await geminiGenerateObject({
            schema: RemediationSchema,
            system: systemPrompt,
            prompt: userPrompt,
        });

        const remediation: Remediation = {
            summary: result.summary,
            steps: result.steps,
            estimated_effort: result.estimated_effort,
            risk_level: result.risk_level,
            applicable_frameworks: result.applicable_frameworks,
        };

        // 6. Cache by rule_id
        remediationCache.set(cacheKey, remediation);
        console.log(`[remediation] Cached fix for rule_id=${cacheKey}`);

        return NextResponse.json(remediation);

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/violations/[id]/remediation error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'Failed to generate remediation. Please try again.' },
            { status: 500 }
        );
    }
}
