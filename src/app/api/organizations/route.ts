import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getSupabaseAdmin } from '@/lib/supabase';
import { getOrgMembershipsForRequest } from '@/lib/org-context';
import { recordOrgEvent, slugFromName, normalizeSlug } from '@/lib/org-management';
import type { OrganizationSummary } from '@/lib/contracts';

async function summariesForUser(
    supabase: Awaited<ReturnType<typeof getOrgMembershipsForRequest>>['supabase'],
    userId: string,
): Promise<OrganizationSummary[]> {
    const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations(id, name, slug, created_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const orgIds = (memberships ?? []).map((membership: any) => membership.organization_id);
    const memberCounts = new Map<string, number>();
    if (orgIds.length > 0) {
        const { data: members } = await supabase
            .from('organization_members')
            .select('organization_id')
            .in('organization_id', orgIds);
        for (const member of members ?? []) {
            memberCounts.set(member.organization_id, (memberCounts.get(member.organization_id) ?? 0) + 1);
        }
    }

    return (memberships ?? [])
        .filter((membership: any) => membership.organizations)
        .map((membership: any) => ({
            id: membership.organizations.id,
            name: membership.organizations.name,
            slug: membership.organizations.slug,
            created_at: membership.organizations.created_at,
            role: membership.role,
            member_count: memberCounts.get(membership.organization_id) ?? 1,
        }));
}

export async function GET(request: NextRequest) {
    try {
        const { supabase, userId } = await getOrgMembershipsForRequest(request);
        return NextResponse.json({ organizations: await summariesForUser(supabase, userId) });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('GET /api/organizations error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to list organizations' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, userId } = await getOrgMembershipsForRequest(request);
        const admin = getSupabaseAdmin();
        const body = await request.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const slug = normalizeSlug(typeof body.slug === 'string' && body.slug.trim() ? body.slug : slugFromName(name));

        if (!name || !slug) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Organization name is required' }, { status: 400 });
        }

        const { data: existing } = await admin
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
        if (existing) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Organization slug is already taken' }, { status: 409 });
        }

        const { data: organization, error: orgError } = await admin
            .from('organizations')
            .insert({ name, slug, created_by: userId })
            .select('id, name, slug, created_at')
            .single();

        if (orgError || !organization) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: orgError?.message ?? 'Failed to create organization' }, { status: 500 });
        }

        const { error: memberError } = await admin.from('organization_members').insert({
            organization_id: organization.id,
            user_id: userId,
            role: 'owner',
        });

        if (memberError) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: memberError.message }, { status: 500 });
        }

        await recordOrgEvent(admin, organization.id, userId, 'organization.created', { name, slug });

        return NextResponse.json({
            organization: {
                ...organization,
                role: 'owner',
                member_count: 1,
            },
            role: 'owner',
        }, { status: 201 });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('POST /api/organizations error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to create organization' }, { status: 500 });
    }
}
