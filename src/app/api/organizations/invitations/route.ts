import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getSupabaseAdmin } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';
import {
    assertOrgAdmin,
    assignRoleErrorMessage,
    createInviteToken,
    hashInviteToken,
    recordOrgEvent,
} from '@/lib/org-management';
import type { OrganizationInvitation, OrganizationRole } from '@/lib/contracts';

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

async function serializeInvitation(row: any): Promise<OrganizationInvitation> {
    return {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        expires_at: row.expires_at,
        created_at: row.created_at,
        invited_by_email: row.invited_by ? await emailByUserId(row.invited_by) : null,
    };
}

async function findUserByEmailIfServiceRoleAvailable(email: string): Promise<{ id: string; email: string } | null> {
    try {
        const admin = getSupabaseAdmin();
        const normalized = email.trim().toLowerCase();
        let page = 1;

        while (page <= MAX_USER_LOOKUP_PAGES) {
            const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
            if (error) return null;
            const user = data.users.find((u) => u.email?.toLowerCase() === normalized);
            if (user?.id && user.email) return { id: user.id, email: user.email };
            if (data.users.length < 1000) break;
            page++;
        }
    } catch {
        return null;
    }

    return null;
}

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        assertOrgAdmin(ctx);

        const { data, error } = await ctx.supabase
            .from('organization_invitations')
            .select('id, email, role, status, expires_at, created_at, invited_by')
            .eq('organization_id', ctx.organizationId)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        return NextResponse.json({
            invitations: await Promise.all((data ?? []).map(serializeInvitation)),
        });
    } catch (err) {
        if (err instanceof AuthError) {
            const status = err.message.includes('Admin') ? 403 : 401;
            return NextResponse.json({ error: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', message: err.message }, { status });
        }
        console.error('GET /api/organizations/invitations error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to load invitations' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        assertOrgAdmin(ctx);

        const body = await request.json();
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const role = body.role as OrganizationRole;
        if (!email || !['owner', 'admin', 'member'].includes(role)) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Valid email and role are required' }, { status: 400 });
        }
        const roleError = assignRoleErrorMessage(ctx.role, role);
        if (roleError) {
            return NextResponse.json({ error: 'FORBIDDEN', message: roleError }, { status: 403 });
        }

        const existingUser = await findUserByEmailIfServiceRoleAvailable(email);
        if (existingUser) {
            const { data: existingMembership } = await ctx.supabase
                .from('organization_members')
                .select('id')
                .eq('organization_id', ctx.organizationId)
                .eq('user_id', existingUser.id)
                .maybeSingle();
            if (existingMembership) {
                return NextResponse.json(
                    { error: 'CONFLICT', message: 'This user is already a member of this organization' },
                    { status: 409 },
                );
            }
        }

        const rawToken = createInviteToken();
        const tokenHash = hashInviteToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: existingInvite } = await ctx.supabase
            .from('organization_invitations')
            .select('id')
            .eq('organization_id', ctx.organizationId)
            .eq('email', email)
            .eq('status', 'pending')
            .maybeSingle();

        let data: any;
        let error: any;
        if (existingInvite) {
            const result = await ctx.supabase
                .from('organization_invitations')
                .update({
                    role,
                    token_hash: tokenHash,
                    expires_at: expiresAt,
                    invited_by: ctx.userId,
                })
                .eq('id', existingInvite.id)
                .select('id, email, role, status, expires_at, created_at, invited_by')
                .single();
            data = result.data;
            error = result.error;
        } else {
            const result = await ctx.supabase
                .from('organization_invitations')
                .insert({
                    organization_id: ctx.organizationId,
                    email,
                    role,
                    token_hash: tokenHash,
                    invited_by: ctx.userId,
                    expires_at: expiresAt,
                })
                .select('id, email, role, status, expires_at, created_at, invited_by')
                .single();
            data = result.data;
            error = result.error;
        }

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        await recordOrgEvent(ctx.supabase, ctx.organizationId, ctx.userId, 'invitation.created', { email, role });

        const inviteUrl = `${new URL(request.url).origin}/invite/accept?token=${encodeURIComponent(rawToken)}`;
        return NextResponse.json({
            invitation: await serializeInvitation(data),
            invite_url: inviteUrl,
        }, { status: existingInvite ? 200 : 201 });
    } catch (err) {
        if (err instanceof AuthError) {
            const status = err.message.includes('Admin') ? 403 : 401;
            return NextResponse.json({ error: status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', message: err.message }, { status });
        }
        console.error('POST /api/organizations/invitations error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to create invitation' }, { status: 500 });
    }
}
