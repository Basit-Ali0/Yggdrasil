// ============================================================
// POST /api/cases/:id/notes — Add analyst note to case (P3-11)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const { supabase, userId } = ctx;
        const body = await request.json();
        const { content } = body as { content: string };

        if (!content?.trim()) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Note content is required' }, { status: 400 });
        }

        const { data: event, error } = await supabase
            .from('case_events')
            .insert({
                case_id: id,
                event_type: 'note',
                actor_id: userId,
                payload: { content: content.trim() },
            })
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        // Touch case activity
        await supabase.from('cases').update({
            latest_activity: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq('id', id);

        return NextResponse.json({ success: true, event }, { status: 201 });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('POST /api/cases/[id]/notes error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
