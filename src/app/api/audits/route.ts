// ============================================================
// POST /api/audits — Create audit + load prebuilt policy
// Response: { audit_id, policy_id, rules } per CONTRACTS.md
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { CreateAuditSchema } from '@/lib/validators';
import { AML_RULES, AML_POLICY_NAME } from '@/lib/policies/aml';
import { v4 as uuid } from 'uuid';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = CreateAuditSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { name, policy_type } = parsed.data;
        const userId = await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Only AML is supported for MVP
        if (policy_type !== 'aml') {
            return NextResponse.json(
                { error: 'NOT_IMPLEMENTED', message: `Policy type '${policy_type}' is not yet available. Use 'aml' for the hackathon demo.` },
                { status: 400 }
            );
        }

        // 1. Create the policy record
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
            console.error('Policy insert error:', policyError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create policy' },
                { status: 500 }
            );
        }

        // 2. Insert rules
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
            console.error('Rules insert error:', rulesError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to insert rules' },
                { status: 500 }
            );
        }

        // 3. Return per CONTRACTS.md: { audit_id, policy_id, rules }
        const auditId = uuid(); // audit is a logical session, not a DB table for MVP

        return NextResponse.json({
            audit_id: auditId,
            policy_id: policyId,
            rules: AML_RULES,
        }, { status: 201 });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/audits error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
