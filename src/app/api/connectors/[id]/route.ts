// ============================================================
// GET    /api/connectors/:id — Read connector detail
// PATCH  /api/connectors/:id — Update connector
// DELETE /api/connectors/:id — Delete connector
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const { data, error } = await ctx.supabase
            .from('connectors')
            .select('id, name, type, config, status, last_tested_at, created_at, updated_at')
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Connector not found' }, { status: 404 });
        }
        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const body = await request.json();

        const allowed = ['name', 'config', 'status'];
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const key of allowed) {
            if (key in body) updates[key] = body[key];
        }

        const { data, error } = await ctx.supabase
            .from('connectors')
            .update(updates)
            .eq('id', id)
            .select('id, name, type, config, status')
            .single();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }
        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const { error } = await ctx.supabase
            .from('connectors')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
