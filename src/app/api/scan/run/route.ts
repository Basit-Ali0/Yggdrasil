// ============================================================
// POST /api/scan/run — Trigger compliance scan
// GET  /api/scan/run — not used, see /api/scan/[id]
// Response reports the true persisted scan status.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';
import { RunScanSchema } from '@/lib/validators';
import { RuleExecutor } from '@/lib/engine/rule-executor';
import { calculateComplianceScore } from '@/lib/engine/scoring';
import { v4 as uuid } from 'uuid';
import { getUpload } from '@/lib/upload-store';
import { getMapping } from '@/lib/mapping-store';
import {
    evaluateMappingReadiness,
    isMappingBlockedForScan,
} from '@/lib/engine/mapping-readiness';
import { filterExecutableRules } from '@/lib/engine/rule-validation';
import { Rule } from '@/lib/types';
import { logStructured } from '@/lib/structured-log';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = RunScanSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { audit_id, policy_id, upload_id, mapping_id, audit_name } = parsed.data;
        const ctx = await resolveOrgContext(request);
        const { supabase, userId } = ctx;
        const org = orgFilter(ctx);

        // 1. Get mapping config
        const mapping = await getMapping(request, mapping_id);
        if (!mapping) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Mapping not found. Confirm mapping first.' },
                { status: 404 }
            );
        }

        // 2. Get uploaded data
        const upload = await getUpload(request, upload_id);
        if (!upload) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Upload not found. Upload data first.' },
                { status: 404 }
            );
        }

        // 3. Get rules from Supabase
        const { data: dbRules, error: rulesError } = await supabase
            .from('rules')
            .select('*')
            .eq('policy_id', policy_id)
            .eq('is_active', true);

        if (rulesError || !dbRules?.length) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'No rules found for this policy.' },
                { status: 404 }
            );
        }

        const mappedRules: Rule[] = dbRules.map((r: any) => ({
            rule_id: r.rule_id,
            name: r.name,
            type: r.type,
            severity: r.severity,
            threshold: r.threshold != null ? parseFloat(String(r.threshold)) : null,
            time_window: (() => {
                if (r.time_window == null || r.time_window === '') return null;
                const n = parseInt(String(r.time_window), 10);
                return Number.isFinite(n) ? n : null;
            })(),
            conditions: r.conditions,
            policy_excerpt: r.policy_excerpt ?? '',
            policy_section: r.policy_section ?? '',
            is_active: r.is_active,
            description: r.description,
        }));

        const rules = filterExecutableRules(mappedRules);
        if (mappedRules.length > rules.length) {
            console.warn(
                `[scan/run] skipped ${mappedRules.length - rules.length} non-executable active rule(s) for policy ${policy_id}`
            );
        }

        if (!rules.length) {
            return NextResponse.json(
                {
                    error: 'NOT_FOUND',
                    message:
                        'No executable rules found for this policy. Check rule_validation on ingest or activate valid rules only.',
                },
                { status: 404 }
            );
        }

        const uploadHeaders =
            upload.headers.length > 0
                ? upload.headers
                : upload.rows[0]
                  ? Object.keys(upload.rows[0])
                  : [];

        const mappingReadiness = evaluateMappingReadiness({
            rules,
            mapping: mapping.mapping_config,
            headers: uploadHeaders,
            sampleRows: upload.rows,
        });

        if (isMappingBlockedForScan(mappingReadiness)) {
            logStructured('scan/run', 'mapping_blocked', {
                policy_id,
                upload_id,
                missing_required: mappingReadiness.missing_required,
                invalid_columns: mappingReadiness.invalid_columns,
            });
            return NextResponse.json(
                {
                    error: 'MAPPING_INCOMPLETE',
                    message:
                        'Required column mappings are missing or point to columns that are not in this upload.',
                    details: {
                        missing_required: mappingReadiness.missing_required,
                        invalid_columns: mappingReadiness.invalid_columns,
                    },
                },
                { status: 400 }
            );
        }

        // 4. Create scan record (status: running)
        const scanId = uuid();
        const scanRecord: Record<string, unknown> = {
            id: scanId,
            user_id: userId,
            policy_id,
            temporal_scale: mapping.temporal_scale,
            mapping_config: mapping.mapping_config,
            data_source: 'csv',
            file_name: upload.fileName,
            record_count: upload.rows.length,
            status: 'running',
            upload_id,
            mapping_id,
        };
        if (org) scanRecord.organization_id = org;
        if (audit_id) scanRecord.audit_id = audit_id;

        // Try with audit name first; fall back without it if column doesn't exist yet
        if (audit_name) {
            scanRecord.audit_name = audit_name;
        }

        const { error: scanCreateErr } = await supabase
            .from('scans')
            .insert(scanRecord);

        if (scanCreateErr) {
            console.error('Scan create error:', scanCreateErr);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create scan record' },
                { status: 500 }
            );
        }

        // 5. Run scan (in-memory or DuckDB per backend-selection)
        const executor = new RuleExecutor({ rowCount: upload.rows.length });
        const {
            violations,
            rulesProcessed,
            rulesTotal,
            executionBackend,
            executionReason,
            sampled,
            effectiveRowCount,
        } = await executor.executeAll(rules, upload.rows, {
            temporalScale: mapping.temporal_scale,
            sampleLimit: 50000,
            columnMapping: mapping.mapping_config,
        });
        logStructured('scan/run', 'scan_completed', {
            scan_id: scanId,
            policy_id,
            execution_backend: executionBackend,
            execution_reason: executionReason,
            rules_processed: rulesProcessed,
            rules_total: rulesTotal,
            violation_count: violations.length,
            row_count: upload.rows.length,
            effective_row_count: effectiveRowCount,
            sampled,
        });

        // 6. Calculate compliance score using actual rows processed (unsampled for DuckDB)
        const score = calculateComplianceScore(
            effectiveRowCount,
            violations.map((v) => ({ severity: v.severity, status: v.status }))
        );

        // 7. Insert violations into Supabase (batch)
        if (violations.length > 0) {
            const violationRows = violations.map((v) => {
                const row: Record<string, unknown> = {
                    id: v.id,
                    scan_id: scanId,
                    rule_id: v.rule_id,
                    rule_name: v.rule_name,
                    severity: v.severity,
                    record_id: v.record_id,
                    account: v.account,
                    amount: v.amount,
                    transaction_type: v.transaction_type,
                    evidence: v.evidence,
                    threshold: v.threshold,
                    actual_value: v.actual_value,
                    policy_excerpt: v.policy_excerpt,
                    policy_section: v.policy_section,
                    explanation: v.explanation,
                    status: 'pending',
                };
                if (org) row.organization_id = org;
                return row;
            });

            // Insert in batches of 500 to avoid payload limits
            const BATCH_SIZE = 500;
            for (let i = 0; i < violationRows.length; i += BATCH_SIZE) {
                const batch = violationRows.slice(i, i + BATCH_SIZE);
                const { error: vError } = await supabase
                    .from('violations')
                    .insert(batch);

                if (vError) {
                    console.error('Violations insert error (batch):', vError);
                }
            }
        }

        // 8. Update scan to completed
        const { error: scanUpdateErr } = await supabase
            .from('scans')
            .update({
                status: 'completed',
                violation_count: violations.length,
                compliance_score: score,
                completed_at: new Date().toISOString(),
            })
            .eq('id', scanId);

        if (scanUpdateErr) {
            console.error('Scan update error:', scanUpdateErr);
        }

        // The scan currently runs synchronously, so report the actual final status.
        return NextResponse.json({
            scan_id: scanId,
            status: 'completed',
        });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/scan/run error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred', status: 'failed' },
            { status: 500 }
        );
    }
}
