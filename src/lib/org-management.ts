import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthError } from '@/lib/supabase';
import type { OrgContext, OrgRole } from '@/lib/org-context';

export type OrganizationEventType =
    | 'organization.created'
    | 'organization.updated'
    | 'invitation.created'
    | 'invitation.revoked'
    | 'member.added'
    | 'member.role_changed'
    | 'member.removed'
    | 'member.left'
    | 'ownership.transferred';

export function assertOrgAdmin(ctx: OrgContext): void {
    if (ctx.role !== 'owner' && ctx.role !== 'admin') {
        throw new AuthError('Admin role required');
    }
}

export function assertOrgOwner(ctx: OrgContext): void {
    if (ctx.role !== 'owner') {
        throw new AuthError('Owner role required');
    }
}

export function normalizeSlug(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}

export function slugFromName(name: string): string {
    const base = normalizeSlug(name);
    return base || `workspace-${crypto.randomBytes(3).toString('hex')}`;
}

export function createInviteToken(): string {
    return crypto.randomBytes(32).toString('base64url');
}

export function hashInviteToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function recordOrgEvent(
    supabase: SupabaseClient,
    organizationId: string,
    actorUserId: string | null,
    eventType: OrganizationEventType,
    metadata: Record<string, unknown> = {},
    targetUserId?: string | null,
): Promise<void> {
    const { error } = await supabase.from('organization_events').insert({
        organization_id: organizationId,
        actor_user_id: actorUserId,
        target_user_id: targetUserId ?? null,
        event_type: eventType,
        metadata,
    });

    if (error && error.code !== '42P01') {
        console.warn('[org-events] failed to record event:', error.message);
    }
}

export async function countOwners(
    supabase: SupabaseClient,
    organizationId: string,
): Promise<number> {
    const { count, error } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'owner');

    if (error) throw new Error(error.message);
    return count ?? 0;
}

export async function ensureOrgHasAnotherOwner(
    supabase: SupabaseClient,
    organizationId: string,
    currentUserId: string,
): Promise<void> {
    const { count, error } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .neq('user_id', currentUserId);

    if (error) throw new Error(error.message);
    if ((count ?? 0) === 0) {
        throw new AuthError('Cannot remove or demote the last owner');
    }
}

export function canManageMember(
    actorRole: OrgRole,
    actorUserId: string,
    targetRole: OrgRole,
    targetUserId: string,
): boolean {
    if (actorUserId === targetUserId) return true;
    if (actorRole === 'owner') return true;
    if (actorRole === 'admin') return targetRole === 'member';
    return false;
}

export function canAssignOrganizationRole(actorRole: OrgRole, requestedRole: OrgRole): boolean {
    if (actorRole === 'owner') return true;
    if (actorRole === 'admin') return requestedRole === 'member';
    return false;
}

export function assignRoleErrorMessage(actorRole: OrgRole, requestedRole: OrgRole): string | null {
    if (canAssignOrganizationRole(actorRole, requestedRole)) return null;
    if (actorRole === 'admin') {
        return 'Admins can only invite or add members';
    }
    return `Cannot assign ${requestedRole} role`;
}
