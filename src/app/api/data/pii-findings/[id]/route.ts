// ============================================================
// PATCH /api/data/pii-findings/:id — Resolve/ignore a PII finding
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status } = body as { status: 'resolved' | 'ignored' };

        if (!status || !['resolved', 'ignored'].includes(status)) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'status must be "resolved" or "ignored"' },
                { status: 400 },
            );
        }

        // Use authenticated client so resolved_by gets the user's ID
        let supabase;
        let userId: string | null = null;
        try {
            supabase = await getSupabaseForRequest(request);
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id ?? null;
        } catch {
            // Fall back to unauthenticated client
            const { getSupabase } = await import('@/lib/supabase');
            supabase = getSupabase();
        }

        const { error: updateError } = await supabase
            .from('pii_findings')
            .update({
                status,
                resolved_at: new Date().toISOString(),
                resolved_by: userId,
            })
            .eq('id', id);

        if (updateError) {
            console.error('[PII Finding PATCH] Update error:', updateError);
            return NextResponse.json(
                { error: 'Internal Server Error', message: 'Failed to update finding' },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[PII Finding PATCH] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal Server Error', message: 'Failed to update finding' },
            { status: 500 },
        );
    }
}
