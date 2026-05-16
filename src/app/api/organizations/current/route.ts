import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getOrgMembershipsForRequest, resolveOrgContext } from '@/lib/org-context';
import { AuthError } from '@/lib/supabase';
import { normalizeSlug, recordOrgEvent } from '@/lib/org-management';

async function memberCounts(supabase: any, orgIds: string[]) {
    const counts = new Map<string, number>();
    if (orgIds.length === 0) return counts;
    const { data } = await supabase
        .from('organization_members')
        .select('organization_id')
        .in('organization_id', orgIds);
    for (const member of data ?? []) {
        counts.set(member.organization_id, (counts.get(member.organization_id) ?? 0) + 1);
    }
    return counts;
}

export async function PATCH(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        if (ctx.role !== 'owner' && ctx.role !== 'admin') {
            return NextResponse.json(
                { error: 'FORBIDDEN', message: 'Admin role required' },
                { status: 403 },
            );
        }

        const body = await request.json();
        const updates: Record<string, unknown> = {};
        if (typeof body.name === 'string' && body.name.trim()) {
            updates.name = body.name.trim();
        }
        if (typeof body.slug === 'string' && body.slug.trim()) {
            const slug = normalizeSlug(body.slug);
            if (!slug) {
                return NextResponse.json(
                    { error: 'VALIDATION_ERROR', message: 'Valid slug is required' },
                    { status: 400 },
                );
            }
            updates.slug = slug;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'No valid updates provided' },
                { status: 400 },
            );
        }

        if (updates.slug) {
            const { data: existing } = await ctx.supabase
                .from('organizations')
                .select('id')
                .eq('slug', updates.slug)
                .neq('id', ctx.organizationId)
                .maybeSingle();
            if (existing) {
                return NextResponse.json(
                    { error: 'VALIDATION_ERROR', message: 'Organization slug is already taken' },
                    { status: 409 },
                );
            }
        }

        const { data, error } = await ctx.supabase
            .from('organizations')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', ctx.organizationId)
            .select('id, name, slug, created_at')
            .single();

        if (error) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: error.message },
                { status: 500 },
            );
        }

        await recordOrgEvent(ctx.supabase, ctx.organizationId, ctx.userId, 'organization.updated', updates);

        return NextResponse.json({ organization: data, role: ctx.role });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('[organizations/current] PATCH error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'Failed to update organization' },
            { status: 500 },
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { supabase, requestedOrgId, memberships } = await getOrgMembershipsForRequest(request);
        const orgIds = memberships.map((membership) => membership.organization_id);
        const counts = await memberCounts(supabase, orgIds);
        const organizations = memberships
            .filter((membership) => membership.organizations)
            .map((membership) => ({
                id: membership.organizations!.id,
                name: membership.organizations!.name,
                slug: membership.organizations!.slug,
                created_at: membership.organizations!.created_at,
                role: membership.role,
                member_count: counts.get(membership.organization_id) ?? 1,
            }));

        const selected =
            organizations.find((org) => org.id === requestedOrgId)
            ?? organizations[0]
            ?? null;

        if (!selected) {
            return NextResponse.json({
                organization: null,
                role: null,
                organizations: [],
                selected_organization_id: null,
                message: 'No organization found. Create or join a workspace to continue.',
            });
        }

        return NextResponse.json({
            organization: selected,
            role: selected.role,
            organizations,
            selected_organization_id: selected.id,
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('[organizations/current] Error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'Failed to resolve organization' },
            { status: 500 }
        );
    }
}
