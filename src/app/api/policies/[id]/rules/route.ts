// ============================================================
// PATCH /api/policies/[id]/rules — Toggle rule is_active
// DELETE /api/policies/[id]/rules — Delete a rule
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { z } from 'zod';

const ToggleRuleSchema = z.object({
    rule_id: z.string().min(1),
    is_active: z.boolean(),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: policyId } = await params;
        const body = await request.json();
        const parsed = ToggleRuleSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { rule_id, is_active } = parsed.data;
        await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Update rule is_active
        const { error: ruleError, count } = await supabase
            .from('rules')
            .update({ is_active })
            .eq('policy_id', policyId)
            .eq('rule_id', rule_id);

        if (ruleError) {
            console.error('Rule toggle error:', ruleError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to update rule' },
                { status: 500 }
            );
        }

        // Update policy updated_at
        const { error: policyError } = await supabase
            .from('policies')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', policyId);

        if (policyError) {
            console.error('Policy update error:', policyError);
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('PATCH /api/policies/[id]/rules error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: policyId } = await params;
        const url = new URL(request.url);
        const ruleId = url.searchParams.get('rule_id');

        if (!ruleId) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Missing rule_id query parameter' },
                { status: 400 }
            );
        }

        await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // Delete the rule
        const { error: deleteError } = await supabase
            .from('rules')
            .delete()
            .eq('policy_id', policyId)
            .eq('rule_id', ruleId);

        if (deleteError) {
            console.error('Rule delete error:', deleteError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to delete rule' },
                { status: 500 }
            );
        }

        // Decrement rules_count and update updated_at
        // First get current count
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
                rules_count: Math.max(0, (policy.rules_count ?? 0) - 1),
                updated_at: new Date().toISOString(),
            })
            .eq('id', policyId);

        if (policyError) {
            console.error('Policy update error:', policyError);
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('DELETE /api/policies/[id]/rules error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
