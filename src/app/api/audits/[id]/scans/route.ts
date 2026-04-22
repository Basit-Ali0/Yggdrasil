// ============================================================
// GET /api/audits/:id/scans — List all scans for an audit
// Includes provenance info (data source, connector, timestamp)
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

        // Verify audit ownership
        const { data: audit, error: auditError } = await ctx.supabase
            .from('audits')
            .select('id, data_source, connector_id')
            .eq('id', id)
            .single();

        if (auditError || !audit) {
            if (auditError?.code === '42P01') {
                return NextResponse.json({ scans: [] });
            }
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Audit not found' }, { status: 404 });
        }

        const { data: scans, error: scansError } = await ctx.supabase
            .from('scans')
            .select('id, status, compliance_score, violation_count, record_count, data_source, file_name, created_at, completed_at')
            .eq('audit_id', id)
            .order('created_at', { ascending: false });

        if (scansError) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: scansError.message }, { status: 500 });
        }

        return NextResponse.json({
            audit_id: id,
            data_source: audit.data_source,
            connector_id: audit.connector_id,
            scans: (scans ?? []).map((s: any) => ({
                id: s.id,
                status: s.status,
                score: s.compliance_score,
                violation_count: s.violation_count,
                record_count: s.record_count,
                data_source: s.data_source ?? 'csv',
                file_name: s.file_name,
                created_at: s.created_at,
                completed_at: s.completed_at,
            })),
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: (err as Error).message }, { status: 401 });
        }
        console.error('GET /api/audits/[id]/scans error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
