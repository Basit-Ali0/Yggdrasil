// ============================================================
// POST /api/policies/prebuilt — Load prebuilt policy pack
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getUserId } from '@/lib/supabase';
import { PrebuiltPolicySchema } from '@/lib/validators';
import { AML_RULES, AML_POLICY_NAME } from '@/lib/policies/aml';
import { v4 as uuid } from 'uuid';

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
        const userId = getUserId();
        const supabase = getSupabase();

        if (type !== 'aml') {
            return NextResponse.json(
                { error: 'NOT_IMPLEMENTED', message: `Policy type '${type}' is not yet available.` },
                { status: 400 }
            );
        }

        const policyId = uuid();

        const { error: policyError } = await supabase
            .from('policies')
            .insert({
                id: policyId,
                user_id: userId,
                name: AML_POLICY_NAME,
                type: 'prebuilt',
                prebuilt_type: 'aml',
                rules_count: AML_RULES.length,
                status: 'active',
            });

        if (policyError) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create policy' },
                { status: 500 }
            );
        }

        const ruleRows = AML_RULES.map((rule) => ({
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
                name: AML_POLICY_NAME,
                type: 'prebuilt',
                prebuilt_type: 'aml',
                rules_count: AML_RULES.length,
                rules: AML_RULES,
                created_at: new Date().toISOString(),
            },
        }, { status: 201 });

    } catch (err) {
        console.error('POST /api/policies/prebuilt error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
