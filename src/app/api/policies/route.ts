// ============================================================
// GET /api/policies — Policy library for current org
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);

        let query = ctx.supabase
            .from('policies')
            .select('id, name, type, prebuilt_type, rules_count, status, created_at, updated_at')
            .order('updated_at', { ascending: false });

        if (org) query = query.eq('organization_id', org);
        else query = query.eq('user_id', ctx.userId);

        const { data: policies, error } = await query;
        if (error) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: error.message },
                { status: 500 },
            );
        }

        const policyIds = (policies ?? []).map((policy: any) => policy.id);
        const { data: rules } = policyIds.length
            ? await ctx.supabase
                .from('rules')
                .select('policy_id, is_active, validation_status')
                .in('policy_id', policyIds)
            : { data: [] as any[] };

        const stats = new Map<string, { active: number; invalid: number }>();
        for (const rule of rules ?? []) {
            const current = stats.get(rule.policy_id) ?? { active: 0, invalid: 0 };
            if (rule.is_active) current.active++;
            if (rule.validation_status === 'invalid') current.invalid++;
            stats.set(rule.policy_id, current);
        }

        return NextResponse.json({
            policies: (policies ?? []).map((policy: any) => {
                const s = stats.get(policy.id) ?? { active: 0, invalid: 0 };
                return {
                    id: policy.id,
                    name: policy.name,
                    type: policy.type,
                    prebuilt_type: policy.prebuilt_type ?? null,
                    rules_count: policy.rules_count ?? 0,
                    active_rule_count: s.active,
                    invalid_rule_count: s.invalid,
                    validation_status: s.invalid > 0 ? 'has_invalid_rules' : 'valid',
                    status: policy.status,
                    created_at: policy.created_at,
                    updated_at: policy.updated_at,
                };
            }),
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 },
            );
        }
        console.error('GET /api/policies error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'Failed to fetch policies' },
            { status: 500 },
        );
    }
}
