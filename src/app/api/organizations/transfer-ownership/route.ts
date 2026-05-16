import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';
import { assertOrgOwner, recordOrgEvent } from '@/lib/org-management';

export async function POST(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        assertOrgOwner(ctx);
        const body = await request.json();
        const targetMemberId = typeof body.target_member_id === 'string' ? body.target_member_id : '';
        const downgradeCurrentTo = ['admin', 'member'].includes(body.downgrade_current_to)
            ? body.downgrade_current_to
            : null;

        if (!targetMemberId) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Target member is required' }, { status: 400 });
        }

        const { data: target, error: targetError } = await ctx.supabase
            .from('organization_members')
            .select('id, user_id, role')
            .eq('id', targetMemberId)
            .eq('organization_id', ctx.organizationId)
            .single();

        if (targetError || !target) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Target member not found' }, { status: 404 });
        }

        const { error: promoteError } = await ctx.supabase
            .from('organization_members')
            .update({ role: 'owner' })
            .eq('id', targetMemberId)
            .eq('organization_id', ctx.organizationId);

        if (promoteError) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: promoteError.message }, { status: 500 });
        }

        if (downgradeCurrentTo) {
            const { error } = await ctx.supabase
                .from('organization_members')
                .update({ role: downgradeCurrentTo })
                .eq('organization_id', ctx.organizationId)
                .eq('user_id', ctx.userId);
            if (error) {
                return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
            }
        }

        await recordOrgEvent(
            ctx.supabase,
            ctx.organizationId,
            ctx.userId,
            'ownership.transferred',
            { previous_role: target.role, downgrade_current_to: downgradeCurrentTo },
            target.user_id,
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof AuthError) {
            const status = err.message.includes('Owner') ? 403 : 401;
            return NextResponse.json({ error: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', message: err.message }, { status });
        }
        console.error('POST /api/organizations/transfer-ownership error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to transfer ownership' }, { status: 500 });
    }
}
