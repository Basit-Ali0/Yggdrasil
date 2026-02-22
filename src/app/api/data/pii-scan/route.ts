// ============================================================
// POST /api/data/pii-scan — Run PII detection on uploaded data
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { uploadStore } from '@/lib/upload-store';
import { geminiGenerateObject } from '@/lib/gemini';
import { PIIDetectionResultSchema } from '@/lib/validators/pii';
import { executePIIDetection } from '@/lib/engine/pii-executor';
import { getSupabase } from '@/lib/supabase';

const PII_SYSTEM_PROMPT = `You are a PII (Personally Identifiable Information) leakage auditor. Your task is to analyze dataset columns and sample data to detect potential PII exposure.

For each column, determine:
1. Whether it likely contains PII data
2. What type of PII (email, phone, ssn, name, address, date_of_birth, credit_card, ip_address, passport, national_id, bank_account, other)
3. A JavaScript-compatible regex pattern to detect this PII type in the data
4. The severity (CRITICAL for ssn/credit_card/passport, HIGH for email/phone/bank_account, MEDIUM for name/address/date_of_birth/ip_address)
5. A violation explanation describing the risk
6. A remediation suggestion (mask, hash, remove, encrypt, etc.)

Only flag columns where you have reasonable confidence (>60%) that PII is present. Analyze both column names AND actual sample data values.`;

/**
 * Fisher-Yates shuffle on indices, return first N.
 */
function sampleIndices(total: number, n: number): number[] {
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, Math.min(n, total));
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { upload_id, scan_id } = body as { upload_id: string; scan_id?: string };
        console.log(`[PII-SCAN] Starting scan for upload_id: ${upload_id}`);

        if (!upload_id) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'upload_id is required' },
                { status: 400 },
            );
        }

        // 1. Get data from uploadStore
        const stored = uploadStore.get(upload_id);
        if (!stored) {
            console.warn(`[PII-SCAN] Upload ${upload_id} not found`);
            return NextResponse.json(
                { error: 'Not Found', message: 'Upload not found — may have expired' },
                { status: 404 },
            );
        }

        const { rows, headers } = stored;
        console.log(`[PII-SCAN] Processing ${rows.length} rows with ${headers.length} columns`);

        // 2. Sample 20 random rows for Gemini analysis
        const sampleIdxs = sampleIndices(rows.length, 20);
        const sampleRows = sampleIdxs.map((i) => rows[i]);

        // 3. Build prompt with column names and sample data
        const prompt = `Analyze the following dataset for PII exposure.

Columns: ${headers.join(', ')}

Sample data (${sampleRows.length} rows):
${sampleRows.map((row) => JSON.stringify(row)).join('\n')}

For each column, evaluate whether it contains PII. Return your findings.`;

        // 4. Call Gemini
        console.log(`[PII-SCAN] Sending ${sampleRows.length} sample rows to Gemini for analysis...`);
        let geminiResult;
        try {
            geminiResult = await geminiGenerateObject({
                schema: PIIDetectionResultSchema,
                prompt,
                system: PII_SYSTEM_PROMPT,
            });
            console.log(`[PII-SCAN] Gemini analysis complete. Found ${geminiResult.findings.length} columns to check.`);
        } catch (err) {
            console.error('[PII Scan] Gemini analysis failed:', err);
            // Graceful degradation: return empty findings, don't block
            return NextResponse.json({
                findings: [],
                summary: 'PII analysis unavailable — Gemini call failed.',
                pii_detected: false,
            });
        }

        // 5. For each finding with contains_pii === true, run detection against ALL rows
        const piiFindings = geminiResult.findings.filter((f) => f.contains_pii);
        console.log(`[PII-SCAN] Running regex detection for ${piiFindings.length} PII types across ${rows.length} rows...`);
        const executionResults = executePIIDetection(rows, piiFindings);
        console.log(`[PII-SCAN] Detection finished. Found matches in ${executionResults.filter(r => r.match_count > 0).length} columns.`);

        // 6. If scan_id provided, persist findings to Supabase
        if (scan_id && executionResults.length > 0) {
            console.log(`[PII-SCAN] Persisting findings to Supabase for scan_id: ${scan_id}`);
            try {
                const supabase = getSupabase();
                const insertRows = executionResults.map((r) => ({
                    scan_id,
                    upload_id,
                    column_name: r.column_name,
                    pii_type: r.pii_type,
                    severity: r.severity,
                    confidence: r.confidence,
                    match_count: r.match_count,
                    total_rows: r.total_rows,
                    sample_values: r.masked_samples,
                    detection_query: r.detection_regex,
                    violation_text: r.violation_text,
                    suggestion: r.suggestion,
                    status: 'open',
                }));

                const { error: insertError } = await supabase
                    .from('pii_findings')
                    .insert(insertRows);

                if (insertError) {
                    console.error('[PII Scan] Failed to persist findings:', insertError);
                }
            } catch (err) {
                console.error('[PII Scan] Supabase insert error:', err);
            }
        }

        // 7. Return findings
        return NextResponse.json({
            findings: executionResults,
            summary: geminiResult.summary,
            pii_detected: executionResults.length > 0,
        });
    } catch (err) {
        console.error('[PII Scan] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal Server Error', message: 'PII scan failed' },
            { status: 500 },
        );
    }
}
