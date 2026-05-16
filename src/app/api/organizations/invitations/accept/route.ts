import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getUserIdFromRequest, getSupabaseForRequest } from '@/lib/supabase';
import { hashInviteToken } from '@/lib/org-management';

export async function POST(request: NextRequest) {
    try {
        const [supabase, userId] = await Promise.all([
            getSupabaseForRequest(request),
            getUserIdFromRequest(request),
        ]);
        const body = await request.json();
        const token = typeof body.token === 'string' ? body.token : '';
        if (!token) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invite token is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .rpc('accept_organization_invitation', { invite_hash: hashInviteToken(token) });

        if (error) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: error.message }, { status: 422 });
        }

        const accepted = Array.isArray(data) ? data[0] : null;
        if (!accepted) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invitation could not be accepted' }, { status: 422 });
        }

        const [{ count }, { data: organization }] = await Promise.all([
            supabase
                .from('organization_members')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', accepted.organization_id),
            supabase
                .from('organizations')
                .select('id, name, slug, created_at')
                .eq('id', accepted.organization_id)
                .single(),
        ]);

        return NextResponse.json({
            organization: {
                id: accepted.organization_id,
                name: organization?.name ?? accepted.organization_name,
                slug: organization?.slug ?? null,
                created_at: organization?.created_at ?? null,
                role: accepted.role,
                member_count: count ?? null,
            },
            role: accepted.role,
            user_id: userId,
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('POST /api/organizations/invitations/accept error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to accept invitation' }, { status: 500 });
    }
}
