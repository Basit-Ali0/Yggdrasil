// ============================================================
// POST /api/policies/prebuilt — Load prebuilt policy pack
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { PrebuiltPolicySchema } from '@/lib/validators';
import { AML_RULES, AML_POLICY_NAME } from '@/lib/policies/aml';
import { GDPR_RULES, GDPR_POLICY_NAME } from '@/lib/policies/gdpr';
import { SOC2_RULES, SOC2_POLICY_NAME } from '@/lib/policies/soc2';
import { v4 as uuid } from 'uuid';
import type { Rule } from '@/lib/types';

function getPolicyPack(policyType: string): { name: string; rules: Rule[] } {
    switch (policyType) {
        case 'aml':
            return { name: AML_POLICY_NAME, rules: AML_RULES };
        case 'gdpr':
            return { name: GDPR_POLICY_NAME, rules: GDPR_RULES };
        case 'soc2':
            return { name: SOC2_POLICY_NAME, rules: SOC2_RULES };
        default:
            throw new Error(`Unknown policy type: ${policyType}`);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = PrebuiltPolicySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { type } = parsed.data;
        const userId = await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        const pack = getPolicyPack(type);
        const policyId = uuid();

        const { error: policyError } = await supabase
            .from('policies')
            .insert({
                id: policyId,
                user_id: userId,
                name: pack.name,
                type: 'prebuilt',
                prebuilt_type: type,
                rules_count: pack.rules.length,
                status: 'active',
            });

        if (policyError) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create policy' },
                { status: 500 }
            );
        }

        const ruleRows = pack.rules.map((rule) => ({
            id: uuid(),
            policy_id: policyId,
            rule_id: rule.rule_id,
            name: rule.name,
            type: rule.type,
            description: rule.description ?? null,
            threshold: rule.threshold,
            time_window: rule.time_window,
            severity: rule.severity,
            conditions: rule.conditions,
            policy_excerpt: rule.policy_excerpt,
            policy_section: rule.policy_section,
            is_active: true,
        }));

        const { error: rulesError } = await supabase
            .from('rules')
            .insert(ruleRows);

        if (rulesError) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to insert rules' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            policy: {
                id: policyId,
                name: pack.name,
                type: 'prebuilt',
                prebuilt_type: type,
                rules_count: pack.rules.length,
                rules: pack.rules,
                created_at: new Date().toISOString(),
            },
        }, { status: 201 });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/policies/prebuilt error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
