// ============================================================
// POST /api/audits — Create audit + load prebuilt policy
// Response: { audit_id, policy_id, rules } per CONTRACTS.md
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { CreateAuditSchema } from '@/lib/validators';
import { AML_RULES, AML_POLICY_NAME } from '@/lib/policies/aml';
import { GDPR_RULES, GDPR_POLICY_NAME } from '@/lib/policies/gdpr';
import { SOC2_RULES, SOC2_POLICY_NAME } from '@/lib/policies/soc2';
import { v4 as uuid } from 'uuid';
import type { Rule } from '@/lib/types';

function getPolicyPack(policyType: string, selectedCategories?: string[]): { name: string; rules: Rule[] } {
    let pack: { name: string; rules: Rule[] };
    
    switch (policyType) {
        case 'aml':
            pack = { name: AML_POLICY_NAME, rules: AML_RULES };
            break;
        case 'gdpr':
            pack = { name: GDPR_POLICY_NAME, rules: GDPR_RULES };
            break;
        case 'soc2':
            pack = { name: SOC2_POLICY_NAME, rules: SOC2_RULES };
            break;
        default:
            // Custom PDF policies are handled by /api/policies/ingest or /api/policies/generate-rules
            // This route only handles prebuilt policy packs
            throw new Error(`No prebuilt policy pack for type: ${policyType}. Use the PDF extraction flow for custom policies.`);
    }

    // Filter rules if categories are selected
    if (selectedCategories && selectedCategories.length > 0) {
        pack.rules = pack.rules.filter(rule => 
            rule.category && selectedCategories.includes(rule.category)
        );
    }

    return pack;
}

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

        const { name, policy_type, selected_categories } = parsed.data;
        const userId = await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        const pack = getPolicyPack(policy_type, selected_categories);

        // 1. Create the policy record
        const policyId = uuid();
        const { error: policyError } = await supabase
            .from('policies')
            .insert({
                id: policyId,
                user_id: userId,
                name: pack.name,
                type: 'prebuilt',
                prebuilt_type: policy_type,
                rules_count: pack.rules.length,
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
        const ruleRows = pack.rules.map((rule) => {
            // Repurpose description to store historical_context for MVP hackathon
            const enrichedDescription = JSON.stringify({
                text: rule.description ?? null,
                historical_context: rule.historical_context ?? null
            });

            return {
                id: uuid(),
                policy_id: policyId,
                rule_id: rule.rule_id,
                name: rule.name,
                type: rule.type,
                description: enrichedDescription,
                threshold: rule.threshold,
                time_window: rule.time_window,
                severity: rule.severity,
                conditions: rule.conditions,
                policy_excerpt: rule.policy_excerpt,
                policy_section: rule.policy_section,
                is_active: true,
            };
        });

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
            rules: pack.rules,
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
