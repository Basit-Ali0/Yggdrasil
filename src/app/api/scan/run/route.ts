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
import { generateCases, isAmlPolicyType, type ViolationForCase } from '@/lib/case-generation';

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

        const mapping = await getMapping(request, mapping_id);
        if (!mapping) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Mapping not found. Confirm mapping first.' },
                { status: 404 }
            );
        }

        const upload = await getUpload(request, upload_id);
        if (!upload) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Upload not found. Upload data first.' },
                { status: 404 }
            );
        }

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

        const mappedRules: Rule[] = dbRules.map((rule: any) => ({
            rule_id: rule.rule_id,
            name: rule.name,
            type: rule.type,
            severity: rule.severity,
            threshold: rule.threshold != null ? parseFloat(String(rule.threshold)) : null,
            time_window: (() => {
                if (rule.time_window == null || rule.time_window === '') return null;
                const parsedWindow = parseInt(String(rule.time_window), 10);
                return Number.isFinite(parsedWindow) ? parsedWindow : null;
            })(),
            conditions: rule.conditions,
            policy_excerpt: rule.policy_excerpt ?? '',
            policy_section: rule.policy_section ?? '',
            is_active: rule.is_active,
            description: rule.description,
            approved_count: rule.approved_count ?? 0,
            false_positive_count: rule.false_positive_count ?? 0,
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
        if (audit_name) scanRecord.audit_name = audit_name;

        const { error: scanCreateErr } = await supabase.from('scans').insert(scanRecord);
        if (scanCreateErr) {
            console.error('Scan create error:', scanCreateErr);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to create scan record' },
                { status: 500 }
            );
        }

        const executor = new RuleExecutor({ rowCount: upload.rows.length });
        const {
            violations,
            trueViolationCount,
            rulesProcessed,
            rulesTotal,
            executionBackend,
            executionReason,
            sampled,
            effectiveRowCount,
        } = await executor.executeAll(
            rules,
            upload.rows,
            {
                temporalScale: mapping.temporal_scale,
                sampleLimit: 50000,
                columnMapping: mapping.mapping_config,
            },
            upload.metadata
        );

        logStructured('scan/run', 'scan_completed', {
            scan_id: scanId,
            policy_id,
            execution_backend: executionBackend,
            execution_reason: executionReason,
            rules_processed: rulesProcessed,
            rules_total: rulesTotal,
            violation_count: trueViolationCount,
            stored_violation_count: violations.length,
            row_count: upload.rows.length,
            effective_row_count: effectiveRowCount,
            sampled,
        });

        const score = calculateComplianceScore(
            effectiveRowCount,
            violations.map((violation) => ({ severity: violation.severity, status: violation.status }))
        );

        if (violations.length > 0) {
            const violationRows = violations.map((violation) => {
                const row: Record<string, unknown> = {
                    id: violation.id,
                    scan_id: scanId,
                    rule_id: violation.rule_id,
                    rule_name: violation.rule_name,
                    severity: violation.severity,
                    record_id: violation.record_id,
                    account: violation.account,
                    amount: violation.amount,
                    transaction_type: violation.transaction_type,
                    evidence: violation.evidence,
                    threshold: violation.threshold,
                    actual_value: violation.actual_value,
                    policy_excerpt: violation.policy_excerpt,
                    policy_section: violation.policy_section,
                    explanation: violation.explanation,
                    status: 'pending',
                };
                if (org) row.organization_id = org;
                return row;
            });

            const batchSize = 2500;
            const batches = [];
            for (let i = 0; i < violationRows.length; i += batchSize) {
                batches.push(violationRows.slice(i, i + batchSize));
            }

            let batchInsertFailed = false;
            const concurrencyLimit = 5;
            for (let i = 0; i < batches.length; i += concurrencyLimit) {
                const chunk = batches.slice(i, i + concurrencyLimit);
                await Promise.all(
                    chunk.map(async (batch) => {
                        const { error } = await supabase.from('violations').insert(batch);
                        if (error) {
                            console.error('[scan/run] violation batch insert error:', error);
                            batchInsertFailed = true;
                        }
                    })
                );
            }

            if (batchInsertFailed) {
                await supabase.from('scans').update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                }).eq('id', scanId);

                return NextResponse.json({
                    scan_id: scanId,
                    status: 'failed',
                    error: 'PARTIAL_INSERT',
                    message: 'Some violation batches failed to persist. Scan marked as failed.',
                }, { status: 500 });
            }
        }

        const completedAt = new Date().toISOString();
        const initialScoreHistory = [
            {
                score,
                timestamp: completedAt,
                action: 'scan_completed',
                violation_id: null,
            },
        ];

        let scanUpdatePayload: Record<string, unknown> = {
            status: 'completed',
            violation_count: trueViolationCount,
            compliance_score: score,
            completed_at: completedAt,
            score_history: initialScoreHistory,
        };

        let { error: scanUpdateErr } = await supabase
            .from('scans')
            .update(scanUpdatePayload)
            .eq('id', scanId);

        if (scanUpdateErr && (scanUpdateErr.code === '42703' || scanUpdateErr.message?.includes('score_history'))) {
            scanUpdatePayload = {
                status: 'completed',
                violation_count: trueViolationCount,
                compliance_score: score,
                completed_at: completedAt,
            };
            const retry = await supabase.from('scans').update(scanUpdatePayload).eq('id', scanId);
            scanUpdateErr = retry.error;
        }

        if (scanUpdateErr) {
            console.error('Scan update error:', scanUpdateErr);
        }

        try {
            await supabase
                .from('pii_findings')
                .update({ scan_id: scanId })
                .eq('upload_id', upload_id)
                .is('scan_id', null);
        } catch (error) {
            console.warn('[scan/run] Failed to link PII findings:', error);
        }

        let casesCreated = 0;
        let subjectsFlagged = 0;

        const policyType = await getPolicyType(supabase, policy_id);
        if (isAmlPolicyType(policyType) && violations.length > 0) {
            try {
                const violationsForCases: ViolationForCase[] = violations.map((violation) => ({
                    id: violation.id,
                    rule_id: violation.rule_id,
                    rule_name: violation.rule_name,
                    severity: violation.severity,
                    account: violation.account ?? '',
                    amount: violation.amount ?? 0,
                    transaction_type: violation.transaction_type,
                    record_id: violation.record_id,
                    recipient: violation.evidence?.recipient as string | undefined,
                }));

                let existingSubjects: Set<string> | undefined;
                if (org) {
                    const { data: priorCases } = await supabase
                        .from('cases')
                        .select('subject_key')
                        .eq('organization_id', org)
                        .neq('scan_id', scanId);
                    if (priorCases) {
                        existingSubjects = new Set(priorCases.map((caseRow: any) => caseRow.subject_key));
                    }
                }

                const generatedCases = generateCases(violationsForCases, existingSubjects);
                const persistedSubjects = new Set<string>();

                for (const generatedCase of generatedCases) {
                    const caseRow: Record<string, unknown> = {
                        id: generatedCase.id,
                        scan_id: scanId,
                        policy_id,
                        subject_key: generatedCase.subject_key,
                        subject_type: generatedCase.subject_type,
                        severity_rollup: generatedCase.severity_rollup,
                        violation_count: generatedCase.violation_count,
                        open_violations: generatedCase.open_violations,
                        suspicious_amount: generatedCase.suspicious_amount,
                        counterparty_count: generatedCase.counterparty_count,
                        priority_score: generatedCase.priority_score,
                        status: 'open',
                    };
                    if (org) caseRow.organization_id = org;
                    if (audit_id) caseRow.audit_id = audit_id;

                    const { error: caseErr } = await supabase.from('cases').insert(caseRow);
                    if (caseErr) {
                        if (caseErr.code === '42P01' || caseErr.message?.includes('does not exist')) {
                            break;
                        }
                        console.error('Case insert error:', caseErr);
                        continue;
                    }

                    casesCreated++;
                    persistedSubjects.add(generatedCase.subject_key);

                    await supabase.from('violations').update({ case_id: generatedCase.id }).in('id', generatedCase.violation_ids);
                    await supabase.from('case_events').insert({
                        case_id: generatedCase.id,
                        event_type: 'created',
                        actor_id: userId,
                        payload: {
                            subject_key: generatedCase.subject_key,
                            violation_count: generatedCase.violation_count,
                            severity_rollup: generatedCase.severity_rollup,
                        },
                    });
                }

                subjectsFlagged = persistedSubjects.size;
            } catch (caseGenErr) {
                console.error('Case generation error (non-fatal):', caseGenErr);
            }
        }

        return NextResponse.json({
            scan_id: scanId,
            status: 'completed',
            ...(casesCreated > 0 ? { cases_created: casesCreated, subjects_flagged: subjectsFlagged } : {}),
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

async function getPolicyType(supabase: any, policyId: string): Promise<string | null> {
    try {
        const { data } = await supabase
            .from('policies')
            .select('prebuilt_type')
            .eq('id', policyId)
            .single();
        return data?.prebuilt_type ?? null;
    } catch {
        return null;
    }
}
