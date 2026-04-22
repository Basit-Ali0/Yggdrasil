// ============================================================
// POST /api/data/mapping/readiness — Pre-scan mapping evaluation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { MappingReadinessRequestSchema } from '@/lib/validators';
import { getUpload } from '@/lib/upload-store';
import { evaluateMappingReadiness } from '@/lib/engine/mapping-readiness';
import { filterExecutableRules } from '@/lib/engine/rule-validation';
import type { Rule } from '@/lib/types';
import { logStructured } from '@/lib/structured-log';

export async function POST(request: NextRequest) {
    try {
        await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);
        const body = await request.json();
        const parsed = MappingReadinessRequestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { policy_id, upload_id, mapping_config, mapping_confidence } = parsed.data;

        const upload = await getUpload(request, upload_id);
        if (!upload) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Upload not found.' },
                { status: 404 }
            );
        }

        const { data: dbRules, error: rulesError } = await supabase
            .from('rules')
            .select('*')
            .eq('policy_id', policy_id)
            .eq('is_active', true);

        if (rulesError) {
            console.error('[mapping/readiness] rules fetch', rulesError);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to load policy rules' },
                { status: 500 }
            );
        }

        const mappedRules: Rule[] = (dbRules ?? []).map((r: Record<string, unknown>) => ({
            rule_id: String(r.rule_id),
            name: String(r.name),
            type: String(r.type),
            severity: r.severity as Rule['severity'],
            threshold: r.threshold != null ? parseFloat(String(r.threshold)) : null,
            time_window:
                r.time_window != null && r.time_window !== ''
                    ? parseInt(String(r.time_window), 10)
                    : null,
            conditions: r.conditions as Rule['conditions'],
            policy_excerpt: String(r.policy_excerpt ?? ''),
            policy_section: String(r.policy_section ?? ''),
            is_active: Boolean(r.is_active),
            description: r.description != null ? String(r.description) : undefined,
        }));

        const executable = filterExecutableRules(mappedRules);

        if (executable.length === 0) {
            return NextResponse.json({
                state: 'blocked',
                missing_required: [],
                invalid_columns: [],
                warnings: ['No executable rules are active for this policy.'],
                required_fields: [],
                rule_dependencies: [],
                sample_normalized_rows: [],
            });
        }

        const headers =
            upload.headers.length > 0
                ? upload.headers
                : upload.rows[0]
                  ? Object.keys(upload.rows[0])
                  : [];

        const result = evaluateMappingReadiness({
            rules: executable,
            mapping: mapping_config,
            headers,
            sampleRows: upload.rows,
            mappingConfidence: mapping_confidence ?? null,
        });

        logStructured('mapping/readiness', 'evaluated', {
            policy_id,
            upload_id,
            state: result.state,
            missing_count: result.missing_required.length,
            warning_count: result.warnings.length,
        });

        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/data/mapping/readiness error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
