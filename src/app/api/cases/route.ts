// ============================================================
// GET /api/cases — List cases for the current org (P3-07)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);
        const { searchParams } = new URL(request.url);

        const status = searchParams.get('status');
        const owner = searchParams.get('owner');
        const auditId = searchParams.get('audit_id');
        const scanId = searchParams.get('scan_id');
        const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500);
        const offset = Number(searchParams.get('offset') ?? 0);

        let query = ctx.supabase
            .from('cases')
            .select('*', { count: 'exact' })
            .order('priority_score', { ascending: false })
            .order('latest_activity', { ascending: false })
            .range(offset, offset + limit - 1);

        if (org) query = query.eq('organization_id', org);
        if (status) query = query.eq('status', status);
        if (owner) query = query.eq('owner_id', owner);
        if (auditId) query = query.eq('audit_id', auditId);
        if (scanId) query = query.eq('scan_id', scanId);

        const { data: cases, error, count } = await query;

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ cases: [], total: 0 });
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        return NextResponse.json({
            cases: cases ?? [],
            total: count ?? 0,
            limit,
            offset,
        });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('GET /api/cases error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
