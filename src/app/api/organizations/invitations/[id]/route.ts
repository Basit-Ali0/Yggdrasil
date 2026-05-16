import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';
import { assertOrgAdmin, recordOrgEvent } from '@/lib/org-management';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        assertOrgAdmin(ctx);

        const { data: existingInvite, error: fetchError } = await ctx.supabase
            .from('organization_invitations')
            .select('id, status')
            .eq('id', id)
            .eq('organization_id', ctx.organizationId)
            .maybeSingle();

        if (fetchError) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: fetchError.message }, { status: 500 });
        }
        if (!existingInvite) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Invitation not found' }, { status: 404 });
        }
        if (existingInvite.status !== 'pending') {
            return NextResponse.json(
                { error: 'CONFLICT', message: 'Invitation is no longer pending' },
                { status: 409 },
            );
        }

        const { data, error } = await ctx.supabase
            .from('organization_invitations')
            .update({ status: 'revoked' })
            .eq('id', id)
            .eq('organization_id', ctx.organizationId)
            .eq('status', 'pending')
            .select('email, role')
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ error: 'CONFLICT', message: 'Invitation is no longer pending' }, { status: 409 });
        }

        await recordOrgEvent(ctx.supabase, ctx.organizationId, ctx.userId, 'invitation.revoked', {
            email: data.email,
            role: data.role,
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof AuthError) {
            const status = err.message.includes('Admin') ? 403 : 401;
            return NextResponse.json({ error: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', message: err.message }, { status });
        }
        console.error('DELETE /api/organizations/invitations/[id] error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to revoke invitation' }, { status: 500 });
    }
}
