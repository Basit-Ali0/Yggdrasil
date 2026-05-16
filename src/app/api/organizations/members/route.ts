// ============================================================
// GET/POST /api/organizations/members
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getSupabaseAdmin } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';
import { assertOrgAdmin, assignRoleErrorMessage, canManageMember, recordOrgEvent } from '@/lib/org-management';

type Role = 'owner' | 'admin' | 'member';
const MAX_USER_LOOKUP_PAGES = 20;

async function emailByUserId(userId: string): Promise<string | null> {
    try {
        const admin = getSupabaseAdmin();
        const { data } = await admin.auth.admin.getUserById(userId);
        return data.user?.email ?? null;
    } catch {
        return null;
    }
}

async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const admin = getSupabaseAdmin();
    const normalized = email.trim().toLowerCase();
    let page = 1;

    while (page <= MAX_USER_LOOKUP_PAGES) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const user = data.users.find((u) => u.email?.toLowerCase() === normalized);
        if (user?.id && user.email) return { id: user.id, email: user.email };
        if (data.users.length < 1000) break;
        page++;
    }

    return null;
}

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const { data, error } = await ctx.supabase
            .from('organization_members')
            .select('id, organization_id, user_id, role, created_at')
            .eq('organization_id', ctx.organizationId)
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        const ownerCount = (data ?? []).filter((member: any) => member.role === 'owner').length;
        const members = await Promise.all((data ?? []).map(async (member: any) => {
            const isCurrentUser = member.user_id === ctx.userId;
            const isLastOwner = member.role === 'owner' && ownerCount <= 1;
            const canManage = canManageMember(ctx.role, ctx.userId, member.role, member.user_id);
            return {
                ...member,
                email: await emailByUserId(member.user_id),
                is_current_user: isCurrentUser,
                is_last_owner: isLastOwner,
                can_remove: canManage && !(isCurrentUser && isLastOwner) && !isLastOwner,
                can_change_role: canManage && !isLastOwner && (ctx.role === 'owner' || member.role === 'member'),
            };
        }));

        return NextResponse.json({ members });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        console.error('GET /api/organizations/members error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch members' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        assertOrgAdmin(ctx);

        const body = await request.json();
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        const role = body.role as Role;
        if (!email || !['owner', 'admin', 'member'].includes(role)) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Valid email and role are required' }, { status: 400 });
        }
        const roleError = assignRoleErrorMessage(ctx.role, role);
        if (roleError) {
            return NextResponse.json({ error: 'FORBIDDEN', message: roleError }, { status: 403 });
        }

        let user: { id: string; email: string } | null = null;
        try {
            user = await findUserByEmail(email);
        } catch (err) {
            return NextResponse.json({
                error: 'PRECONDITION',
                message: err instanceof Error ? err.message : 'SUPABASE_SERVICE_ROLE_KEY is required for user lookup',
            }, { status: 503 });
        }

        if (!user) {
            return NextResponse.json({
                error: 'NOT_FOUND',
                message: 'User must sign up before they can be added to this organization.',
            }, { status: 404 });
        }

        const { data: existingMembership } = await ctx.supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', ctx.organizationId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (existingMembership) {
            return NextResponse.json(
                { error: 'CONFLICT', message: 'This user is already a member of this organization' },
                { status: 409 },
            );
        }

        const { data, error } = await ctx.supabase
            .from('organization_members')
            .insert({
                organization_id: ctx.organizationId,
                user_id: user.id,
                role,
            })
            .select('id, organization_id, user_id, role, created_at')
            .single();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        await recordOrgEvent(ctx.supabase, ctx.organizationId, ctx.userId, 'member.added', { email: user.email, role }, user.id);

        return NextResponse.json({ member: { ...data, email: user.email } }, { status: 201 });
    } catch (err) {
        if (err instanceof AuthError) {
            const status = err.message.includes('Admin') ? 403 : 401;
            return NextResponse.json({ error: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', message: err.message }, { status });
        }
        console.error('POST /api/organizations/members error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to add member' }, { status: 500 });
    }
}
