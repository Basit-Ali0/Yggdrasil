import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getSupabaseAdmin } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';
import { parseOrganizationEventsLimit } from '@/lib/request-limits';

async function emailMapFor(userIds: string[]) {
    const entries = new Map<string, string | null>();
    try {
        const admin = getSupabaseAdmin();
        await Promise.all([...new Set(userIds.filter(Boolean))].map(async (id) => {
            const { data } = await admin.auth.admin.getUserById(id);
            entries.set(id, data.user?.email ?? null);
        }));
    } catch {
        for (const id of userIds) entries.set(id, null);
    }
    return entries;
}

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const limit = parseOrganizationEventsLimit(request.nextUrl.searchParams.get('limit'));
        const { data, error } = await ctx.supabase
            .from('organization_events')
            .select('id, event_type, actor_user_id, target_user_id, metadata, created_at')
            .eq('organization_id', ctx.organizationId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        const ids = (data ?? []).flatMap((event: any) => [event.actor_user_id, event.target_user_id].filter(Boolean));
        const emails = await emailMapFor(ids);

        return NextResponse.json({
            events: (data ?? []).map((event: any) => ({
                id: event.id,
                event_type: event.event_type,
                actor_email: event.actor_user_id ? emails.get(event.actor_user_id) ?? null : null,
                target_email: event.target_user_id ? emails.get(event.target_user_id) ?? null : null,
                metadata: event.metadata ?? {},
                created_at: event.created_at,
            })),
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('GET /api/organizations/events error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to load organization events' }, { status: 500 });
    }
}
