// ============================================================
// Org context resolution — standard path for all org-scoped API routes
// ============================================================

import type { NextRequest } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';

export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgContext {
    userId: string;
    organizationId: string;
    role: OrgRole;
    supabase: Awaited<ReturnType<typeof getSupabaseForRequest>>;
}

export interface OrgMembership {
    organization_id: string;
    role: OrgRole;
    organizations: {
        id: string;
        name: string;
        slug: string;
        created_at: string;
    } | null;
}

/**
 * Resolve the authenticated user's current organization and role.
 *
 * Resolution order:
 * 1. `X-Organization-Id` header (future multi-org support)
 * 2. Single org membership (P2 default — each user has one org)
 *
 * Throws AuthError if:
 * - User is not authenticated
 * - User has no org membership
 * - Specified org header doesn't match any membership
 */
export async function resolveOrgContext(request: NextRequest): Promise<OrgContext> {
    const [supabase, userId] = await Promise.all([
        getSupabaseForRequest(request),
        getUserIdFromRequest(request),
    ]);

    const requestedOrgId = request.headers.get('X-Organization-Id');

    let query = supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId);

    if (requestedOrgId) {
        query = query.eq('organization_id', requestedOrgId);
    }

    const { data: memberships, error } = await query;

    if (error) {
        if (isMissingTableError(error)) {
            return fallbackToUserOnly(supabase, userId);
        }
        throw new AuthError(`Failed to resolve org membership: ${error.message}`);
    }

    if (!memberships || memberships.length === 0) {
        if (requestedOrgId) {
            throw new AuthError('Not a member of the requested organization');
        }
        throw new AuthError('User has no organization membership. Please complete onboarding.');
    }

    const membership = memberships[0];
    return {
        userId,
        organizationId: membership.organization_id,
        role: membership.role as OrgRole,
        supabase,
    };
}

export async function getOrgMembershipsForRequest(
    request: NextRequest,
): Promise<{
    supabase: Awaited<ReturnType<typeof getSupabaseForRequest>>;
    userId: string;
    requestedOrgId: string | null;
    memberships: OrgMembership[];
}> {
    const [supabase, userId] = await Promise.all([
        getSupabaseForRequest(request),
        getUserIdFromRequest(request),
    ]);
    const requestedOrgId = request.headers.get('X-Organization-Id');

    const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations(id, name, slug, created_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        if (isMissingTableError(error)) {
            return { supabase, userId, requestedOrgId, memberships: [] };
        }
        throw new AuthError(`Failed to resolve org memberships: ${error.message}`);
    }

    const memberships = (data ?? []).map((membership: any) => ({
        organization_id: membership.organization_id,
        role: membership.role as OrgRole,
        organizations: Array.isArray(membership.organizations)
            ? membership.organizations[0] ?? null
            : membership.organizations ?? null,
    }));

    return {
        supabase,
        userId,
        requestedOrgId,
        memberships,
    };
}

/**
 * Pre-migration fallback: when the organizations table doesn't exist yet,
 * return a synthetic context so existing APIs keep working.
 * The organizationId is empty — callers should treat this as "no org scoping".
 * Role is set to 'member' (not 'owner') so requireAdmin() rejects by default.
 */
function fallbackToUserOnly(
    supabase: Awaited<ReturnType<typeof getSupabaseForRequest>>,
    userId: string
): OrgContext {
    return {
        userId,
        organizationId: '',
        role: 'member',
        supabase,
    };
}

function isMissingTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    const message =
        'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
    return code === '42P01' || message.toLowerCase().includes('does not exist');
}

/**
 * Check if user has admin-level access (owner or admin role).
 */
export function requireAdmin(ctx: OrgContext): void {
    if (ctx.role !== 'owner' && ctx.role !== 'admin') {
        throw new AuthError('Insufficient permissions: admin role required');
    }
}

/**
 * Build an org-scoped query filter. Returns the organization_id to use in
 * `.eq('organization_id', ...)` calls, or null if org scoping isn't active yet.
 */
export function orgFilter(ctx: OrgContext): string | null {
    return ctx.organizationId || null;
}
