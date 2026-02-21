// ============================================================
// GET /api/policies/[id] — Get policy with rules + dirty flag
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await getSupabaseForRequest(request);

        const { data: policy, error: policyError } = await supabase
            .from('policies')
            .select('*')
            .eq('id', id)
            .single();

        if (policyError || !policy) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Policy not found' },
                { status: 404 }
            );
        }

        const { data: rules } = await supabase
            .from('rules')
            .select('*')
            .eq('policy_id', id)
            .order('created_at', { ascending: true });

        // Dirty detection: compare policy.updated_at against latest completed scan
        let dirty = false;
        const { data: latestScan } = await supabase
            .from('scans')
            .select('completed_at')
            .eq('policy_id', id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)
            .single();

        if (latestScan?.completed_at && policy.updated_at) {
            dirty = new Date(policy.updated_at) > new Date(latestScan.completed_at);
        }
        // If no scans exist yet, dirty = false (nothing to rescan against)

        return NextResponse.json({
            id: policy.id,
            name: policy.name,
            type: policy.type,
            prebuilt_type: policy.prebuilt_type,
            rules_count: policy.rules_count,
            rules: (rules ?? []).map((r: any) => ({
                rule_id: r.rule_id,
                name: r.name,
                type: r.type,
                severity: r.severity,
                threshold: r.threshold ? parseFloat(r.threshold) : null,
                time_window: r.time_window,
                conditions: r.conditions,
                policy_excerpt: r.policy_excerpt,
                policy_section: r.policy_section,
                is_active: r.is_active,
            })),
            created_at: policy.created_at,
            updated_at: policy.updated_at,
            dirty,
        });

    } catch (err) {
        console.error('GET /api/policies/[id] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
