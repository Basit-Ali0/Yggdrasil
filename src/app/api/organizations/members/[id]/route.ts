// ============================================================
// PATCH/DELETE /api/organizations/members/:id
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';
import {
    canManageMember,
    ensureOrgHasAnotherOwner,
    recordOrgEvent,
} from '@/lib/org-management';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);

        const body = await request.json();
        const role = body.role as string;
        if (!['owner', 'admin', 'member'].includes(role)) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Valid role is required' }, { status: 400 });
        }

        const { data: existing, error: fetchError } = await ctx.supabase
            .from('organization_members')
            .select('id, organization_id, user_id, role')
            .eq('id', id)
            .eq('organization_id', ctx.organizationId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Member not found' }, { status: 404 });
        }

        if (existing.user_id === ctx.userId && existing.role !== 'owner') {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'Only owners can change their own role' }, { status: 403 });
        }
        if (!canManageMember(ctx.role, ctx.userId, existing.role, existing.user_id)) {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'Insufficient permissions to change this member' }, { status: 403 });
        }
        if (existing.role === 'owner' && role !== 'owner') {
            await ensureOrgHasAnotherOwner(ctx.supabase, ctx.organizationId, existing.user_id);
        }
        if (ctx.role === 'admin' && role !== 'member') {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'Admins can only manage members' }, { status: 403 });
        }

        const { data, error } = await ctx.supabase
            .from('organization_members')
            .update({ role })
            .eq('id', id)
            .eq('organization_id', ctx.organizationId)
            .select('id, organization_id, user_id, role, created_at')
            .single();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        await recordOrgEvent(
            ctx.supabase,
            ctx.organizationId,
            ctx.userId,
            'member.role_changed',
            { previous_role: existing.role, new_role: role },
            existing.user_id,
        );

        return NextResponse.json({ member: data });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'FORBIDDEN', message: err.message }, { status: 403 });
        console.error('PATCH /api/organizations/members/[id] error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to update member' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);

        const { data: existing, error: fetchError } = await ctx.supabase
            .from('organization_members')
            .select('id, organization_id, user_id, role')
            .eq('id', id)
            .eq('organization_id', ctx.organizationId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Member not found' }, { status: 404 });
        }

        if (!canManageMember(ctx.role, ctx.userId, existing.role, existing.user_id)) {
            return NextResponse.json({ error: 'FORBIDDEN', message: 'Insufficient permissions to remove this member' }, { status: 403 });
        }
        if (existing.role === 'owner') {
            await ensureOrgHasAnotherOwner(ctx.supabase, ctx.organizationId, existing.user_id);
        }

        const { error } = await ctx.supabase
            .from('organization_members')
            .delete()
            .eq('id', id)
            .eq('organization_id', ctx.organizationId);

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        await recordOrgEvent(
            ctx.supabase,
            ctx.organizationId,
            ctx.userId,
            existing.user_id === ctx.userId ? 'member.left' : 'member.removed',
            { role: existing.role },
            existing.user_id,
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'FORBIDDEN', message: err.message }, { status: 403 });
        console.error('DELETE /api/organizations/members/[id] error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to remove member' }, { status: 500 });
    }
}
