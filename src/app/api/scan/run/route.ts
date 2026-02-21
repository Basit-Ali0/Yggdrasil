// ============================================================
// POST /api/scan/run — Trigger compliance scan
// GET  /api/scan/run — not used, see /api/scan/[id]
// Response: { scan_id, status: "running" } per CONTRACTS.md
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest, AuthError } from '@/lib/supabase';
import { RunScanSchema } from '@/lib/validators';
import { RuleExecutor } from '@/lib/engine/rule-executor';
import { calculateComplianceScore } from '@/lib/engine/scoring';
import { v4 as uuid } from 'uuid';
import { uploadStore } from '@/lib/upload-store';
import { mappingStore } from '@/lib/mapping-store';
import { Rule } from '@/lib/types';

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
        const userId = await getUserIdFromRequest(request);
        const supabase = await getSupabaseForRequest(request);

        // 1. Get mapping config
        const mapping = mappingStore.get(mapping_id);
        if (!mapping) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Mapping not found. Confirm mapping first.' },
                { status: 404 }
            );
        }

        // 2. Get uploaded data
        const upload = uploadStore.get(upload_id);
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

        // Map DB rule rows to Rule interface
        const rules: Rule[] = dbRules.map((r: any) => ({
            rule_id: r.rule_id,
            name: r.name,
            type: r.type,
            severity: r.severity,
            threshold: r.threshold ? parseFloat(r.threshold) : null,
            time_window: r.time_window,
            conditions: r.conditions,
            policy_excerpt: r.policy_excerpt ?? '',
            policy_section: r.policy_section ?? '',
            is_active: r.is_active,
            description: r.description,
        }));

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
        };

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

        // 5. Run scan synchronously (< 5s for 50K rows)
        const executor = new RuleExecutor();
        const { violations, rulesProcessed, rulesTotal } = executor.executeAll(
            rules,
            upload.rows,
            {
                temporalScale: mapping.temporal_scale,
                sampleLimit: 50000,
                columnMapping: mapping.mapping_config,
            }
        );

        // 6. Calculate compliance score
        const score = calculateComplianceScore(
            Math.min(upload.rows.length, 50000),
            violations.map((v) => ({ severity: v.severity, status: v.status }))
        );

        // 7. Insert violations into Supabase (batch)
        if (violations.length > 0) {
            const violationRows = violations.map((v) => ({
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
            }));

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

        // Return initial response per CONTRACTS.md
        return NextResponse.json({
            scan_id: scanId,
            status: 'running',
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
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
