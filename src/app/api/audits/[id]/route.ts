// ============================================================
// GET  /api/audits/:id — Audit detail with related entities
// PATCH /api/audits/:id — Update audit state/relationships
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const { supabase } = ctx;

        const { data: audit, error } = await supabase
            .from('audits')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !audit) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Audit not found' },
                { status: 404 }
            );
        }

        // Fetch related entities in parallel
        const [policyResult, uploadResult, mappingResult, scanResult] = await Promise.all([
            audit.policy_id
                ? supabase.from('policies').select('id, name, type, prebuilt_type, rules_count').eq('id', audit.policy_id).single()
                : { data: null, error: null },
            audit.upload_id
                ? supabase.from('uploaded_datasets').select('id, file_name, row_count, created_at').eq('id', audit.upload_id).single()
                : { data: null, error: null },
            audit.mapping_id
                ? supabase.from('mapping_configs').select('id, mapping_config, temporal_scale').eq('id', audit.mapping_id).single()
                : { data: null, error: null },
            audit.latest_scan_id
                ? supabase.from('scans').select('id, status, compliance_score, violation_count, created_at, completed_at').eq('id', audit.latest_scan_id).single()
                : { data: null, error: null },
        ]);

        const canRescan =
            audit.status === 'completed' &&
            audit.upload_id != null &&
            audit.mapping_id != null;

        return NextResponse.json({
            id: audit.id,
            name: audit.name,
            status: audit.status,
            organization_id: audit.organization_id,
            data_source: audit.data_source,
            connector_id: audit.connector_id,
            error_message: audit.error_message,
            created_at: audit.created_at,
            updated_at: audit.updated_at,
            policy: policyResult.data
                ? {
                    id: policyResult.data.id,
                    name: policyResult.data.name,
                    type: policyResult.data.type,
                    prebuilt_type: policyResult.data.prebuilt_type,
                    rules_count: policyResult.data.rules_count,
                }
                : null,
            upload: uploadResult.data
                ? {
                    id: uploadResult.data.id,
                    file_name: uploadResult.data.file_name,
                    row_count: uploadResult.data.row_count,
                    created_at: uploadResult.data.created_at,
                }
                : null,
            mapping: mappingResult.data
                ? {
                    id: mappingResult.data.id,
                    ready: true,
                }
                : null,
            latest_scan: scanResult.data
                ? {
                    id: scanResult.data.id,
                    status: scanResult.data.status,
                    score: scanResult.data.compliance_score,
                    violation_count: scanResult.data.violation_count,
                    created_at: scanResult.data.created_at,
                    completed_at: scanResult.data.completed_at,
                }
                : null,
            can_rescan: canRescan,
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('GET /api/audits/[id] error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch audit' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const { supabase } = ctx;
        const body = await request.json();

        const allowedFields = [
            'name', 'status', 'policy_id', 'upload_id', 'mapping_id',
            'latest_scan_id', 'data_source', 'connector_id', 'error_message',
        ];

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const field of allowedFields) {
            if (field in body) {
                updates[field] = body[field];
            }
        }

        const { data: audit, error } = await supabase
            .from('audits')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return NextResponse.json(
                    { error: 'NOT_AVAILABLE', message: 'Audits table not yet migrated' },
                    { status: 501 }
                );
            }
            console.error('PATCH /api/audits/[id] error:', error);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to update audit' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, audit });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('PATCH /api/audits/[id] error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to update audit' }, { status: 500 });
    }
}
