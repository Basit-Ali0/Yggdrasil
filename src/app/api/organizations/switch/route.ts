import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { getOrgMembershipsForRequest } from '@/lib/org-context';

export async function POST(request: NextRequest) {
    try {
        const { memberships, supabase } = await getOrgMembershipsForRequest(request);
        const body = await request.json();
        const organizationId = typeof body.organization_id === 'string' ? body.organization_id : '';
        const membership = memberships.find((item) => item.organization_id === organizationId);

        if (!membership?.organizations) {
            return NextResponse.json(
                { error: 'FORBIDDEN', message: 'Not a member of the requested organization' },
                { status: 403 },
            );
        }

        const { count } = await supabase
            .from('organization_members')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId);

        return NextResponse.json({
            organization: {
                id: membership.organizations.id,
                name: membership.organizations.name,
                slug: membership.organizations.slug,
                created_at: membership.organizations.created_at,
                role: membership.role,
                member_count: count ?? null,
            },
            role: membership.role,
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('POST /api/organizations/switch error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to switch organization' }, { status: 500 });
    }
}
