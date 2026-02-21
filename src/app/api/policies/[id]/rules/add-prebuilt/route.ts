// ============================================================
// POST /api/policies/[id]/rules/add-prebuilt — Add prebuilt rules to existing policy
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { AML_RULES } from '@/lib/policies/aml';
import { GDPR_RULES } from '@/lib/policies/gdpr';
import { SOC2_RULES } from '@/lib/policies/soc2';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import type { Rule } from '@/lib/types';

const AddPrebuiltSchema = z.object({
    policy_type: z.enum(['aml', 'gdpr', 'soc2']),
    selected_categories: z.array(z.string()).optional(),
});

function getPrebuiltRules(policyType: string, selectedCategories?: string[]): Rule[] {
    let rules: Rule[];

    switch (policyType) {
        case 'aml':
            rules = AML_RULES;
            break;
        case 'gdpr':
            rules = GDPR_RULES;
            break;
        case 'soc2':
            rules = SOC2_RULES;
            break;
        default:
            throw new Error(`Unknown policy type: ${policyType}`);
    }

    // Filter rules if categories are selected
    if (selectedCategories && selectedCategories.length > 0) {
        rules = rules.filter(rule =>
            rule.category && selectedCategories.includes(rule.category)
        );
    }

    return rules;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: policyId } = await params;
        const body = await request.json();
        const parsed = AddPrebuiltSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { policy_type, selected_categories } = parsed.data;
        await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Load prebuilt rules for the given policy type
        const prebuiltRules = getPrebuiltRules(policy_type, selected_categories);

        // Get existing rule_ids for this policy to avoid duplicates
        const { data: existingRules, error: existingError } = await supabase
            .from('rules')
            .select('rule_id')
            .eq('policy_id', policyId);

        if (existingError) {
            console.error('Existing rules fetch error:', existingError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch existing rules' },
                { status: 500 }
            );
        }

        const existingRuleIds = new Set((existingRules ?? []).map((r: any) => r.rule_id));

        // Filter out duplicates
        const newRules = prebuiltRules.filter(rule => !existingRuleIds.has(rule.rule_id));

        if (newRules.length === 0) {
            return NextResponse.json({ added_count: 0, rules: [] });
        }

        // Insert new rules
        const ruleRows = newRules.map((rule) => {
            const enrichedDescription = JSON.stringify({
                text: rule.description ?? null,
                historical_context: rule.historical_context ?? null,
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

        const { error: insertError } = await supabase
            .from('rules')
            .insert(ruleRows);

        if (insertError) {
            console.error('Rules insert error:', insertError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to insert rules' },
                { status: 500 }
            );
        }

        // Update policy: increment rules_count and set updated_at
        const { data: policy, error: fetchError } = await supabase
            .from('policies')
            .select('rules_count')
            .eq('id', policyId)
            .single();

        if (fetchError || !policy) {
            console.error('Policy fetch error:', fetchError);
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Policy not found' },
                { status: 404 }
            );
        }

        const { error: policyError } = await supabase
            .from('policies')
            .update({
                rules_count: (policy.rules_count ?? 0) + newRules.length,
                updated_at: new Date().toISOString(),
            })
            .eq('id', policyId);

        if (policyError) {
            console.error('Policy update error:', policyError);
        }

        return NextResponse.json({
            added_count: newRules.length,
            rules: newRules,
        });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/policies/[id]/rules/add-prebuilt error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
