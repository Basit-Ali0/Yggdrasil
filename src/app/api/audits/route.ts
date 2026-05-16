// ============================================================
// POST /api/audits — Create audit + load prebuilt policy
// GET  /api/audits — List audits for the current org
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';
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

    if (selectedCategories && selectedCategories.length > 0) {
        pack.rules = pack.rules.filter(rule =>
            rule.category && selectedCategories.includes(rule.category)
        );
    }

    return pack;
}

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);

        let query = ctx.supabase
            .from('audits')
            .select('id, name, status, policy_id, data_source, created_at, updated_at, latest_scan_id')
            .order('updated_at', { ascending: false });

        if (org) {
            query = query.eq('organization_id', org);
        } else {
            query = query.eq('user_id', ctx.userId);
        }

        const { data: audits, error } = await query;

        if (error) {
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return NextResponse.json({ audits: [] });
            }
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch audits' },
                { status: 500 }
            );
        }

        return NextResponse.json({ audits: audits ?? [] });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('GET /api/audits error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch audits' }, { status: 500 });
    }
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

        const { name, policy_type, policy_id, selected_categories } = parsed.data;
        const ctx = await resolveOrgContext(request);
        const { supabase, userId } = ctx;
        const org = orgFilter(ctx);

        if (policy_id) {
            let policyQuery = supabase
                .from('policies')
                .select('id, name, type, prebuilt_type, rules_count')
                .eq('id', policy_id);
            if (org) policyQuery = policyQuery.eq('organization_id', org);
            else policyQuery = policyQuery.eq('user_id', userId);

            const { data: existingPolicy, error: policyFetchError } = await policyQuery.single();
            if (policyFetchError || !existingPolicy) {
                return NextResponse.json(
                    { error: 'NOT_FOUND', message: 'Policy not found' },
                    { status: 404 },
                );
            }

            const auditId = uuid();
            const auditRow: Record<string, unknown> = {
                id: auditId,
                user_id: userId,
                name,
                status: 'draft',
                policy_id,
                data_source: 'csv',
            };
            if (org) auditRow.organization_id = org;

            const { error: auditError } = await supabase.from('audits').insert(auditRow);
            if (auditError) {
                return NextResponse.json(
                    { error: 'INTERNAL_ERROR', message: 'Failed to create audit record' },
                    { status: 500 },
                );
            }

            const { data: rules } = await supabase
                .from('rules')
                .select('*')
                .eq('policy_id', policy_id)
                .order('created_at', { ascending: true });

            return NextResponse.json({
                audit_id: auditId,
                policy_id,
                rules: (rules ?? []).map((rule: any) => ({
                    rule_id: rule.rule_id,
                    name: rule.name,
                    type: rule.type,
                    severity: rule.severity,
                    threshold: rule.threshold ? parseFloat(rule.threshold) : null,
                    time_window: rule.time_window,
                    conditions: rule.conditions,
                    policy_excerpt: rule.policy_excerpt,
                    policy_section: rule.policy_section,
                    is_active: rule.is_active,
                    validation_status: rule.validation_status ?? null,
                    validation_issues: rule.validation_issues ?? null,
                })),
            }, { status: 201 });
        }

        const pack = getPolicyPack(policy_type!, selected_categories);

        // 1. Create the policy record
        const policyId = uuid();
        const policyRow: Record<string, unknown> = {
            id: policyId,
            user_id: userId,
            name: pack.name,
            type: 'prebuilt',
            prebuilt_type: policy_type,
            rules_count: pack.rules.length,
            status: 'active',
        };
        if (org) policyRow.organization_id = org;

        const { error: policyError } = await supabase
            .from('policies')
            .insert(policyRow);

        if (policyError) {
            console.error('Policy insert error:', policyError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create policy' },
                { status: 500 }
            );
        }

        // 2. Insert rules
        const ruleRows = pack.rules.map((rule) => {
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

        // 3. Create audit record (persisted lifecycle)
        const auditId = uuid();
        const auditRow: Record<string, unknown> = {
            id: auditId,
            user_id: userId,
            name,
            status: 'draft',
            policy_id: policyId,
            data_source: 'csv',
        };
        if (org) auditRow.organization_id = org;

        const { error: auditError } = await supabase
            .from('audits')
            .insert(auditRow);

        if (auditError) {
            if (auditError.code === '42P01' || auditError.message?.includes('does not exist')) {
                console.warn('Audit table not yet migrated — skipping insert');
            } else {
                console.error('Audit insert error:', auditError);
                return NextResponse.json(
                    { error: 'INTERNAL_ERROR', message: 'Failed to create audit record' },
                    { status: 500 }
                );
            }
        }

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
