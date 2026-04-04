// ============================================================
// POST /api/cases/:id/assign — Assign or reassign case owner (P3-10)
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
        const { owner_id } = body as { owner_id: string };

        if (!owner_id) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'owner_id is required' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('cases')
            .update({
                owner_id,
                assigned_at: now,
                updated_at: now,
                latest_activity: now,
                status: 'in_review',
            })
            .eq('id', id)
            .select('id, owner_id, status')
            .single();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        await supabase.from('case_events').insert({
            case_id: id,
            event_type: 'assigned',
            actor_id: userId,
            payload: { new_owner: owner_id },
        });

        return NextResponse.json({ success: true, case: data });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('POST /api/cases/[id]/assign error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
