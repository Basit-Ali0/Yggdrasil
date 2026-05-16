import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { hashInviteToken } from '@/lib/org-management';

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token') ?? '';
    if (!token) {
        return NextResponse.json({ invitation: null });
    }

    const { data, error } = await getSupabase()
        .rpc('resolve_organization_invitation', { invite_hash: hashInviteToken(token) });

    if (error) {
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
    }

    const invite = Array.isArray(data) ? data[0] : null;
    return NextResponse.json({
        invitation: invite
            ? {
                organization_id: invite.organization_id,
                organization_name: invite.organization_name,
                email: invite.email,
                role: invite.role,
                status: invite.status,
                expires_at: invite.expires_at,
                created_at: invite.created_at,
            }
            : null,
    });
}
