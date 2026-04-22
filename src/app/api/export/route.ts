// ============================================================
// GET /api/export — Export compliance report (JSON or PDF)
// ?scan_id=...&format=json|pdf
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';
import { generatePdfBuffer, type PdfReportData } from '@/lib/pdf-report';

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const { supabase, userId } = ctx;
        const org = orgFilter(ctx);
        const { searchParams } = new URL(request.url);
        const scanId = searchParams.get('scan_id');
        const format = searchParams.get('format') ?? 'json';

        // Resolve target scan
        let targetScanId = scanId;
        if (!targetScanId) {
            let latestQuery = supabase
                .from('scans')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(1);
            latestQuery = org
                ? latestQuery.eq('organization_id', org)
                : latestQuery.eq('user_id', userId);
            const { data: latestScan } = await latestQuery.single();

            if (!latestScan) {
                return NextResponse.json(
                    { error: 'NOT_FOUND', message: 'No scans found' },
                    { status: 404 }
                );
            }
            targetScanId = latestScan.id;
        }

        // Fetch scan, policy, violations, org in parallel
        const [scanResult, violationsResult] = await Promise.all([
            supabase.from('scans').select('*').eq('id', targetScanId).single(),
            supabase.from('violations').select('*').eq('scan_id', targetScanId),
        ]);

        const scan = scanResult.data;
        if (!scan) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Scan not found' }, { status: 404 });
        }

        const [policyResult, orgResult, auditResult] = await Promise.all([
            supabase.from('policies').select('id, name, type, prebuilt_type, rules_count').eq('id', scan.policy_id).single(),
            org ? supabase.from('organizations').select('id, name').eq('id', org).single() : { data: null },
            scan.audit_id ? supabase.from('audits').select('id, name').eq('id', scan.audit_id).single() : { data: null },
        ]);

        const violations = violationsResult.data ?? [];
        const policy = policyResult.data;
        const orgData = orgResult.data as { id: string; name: string } | null;
        const auditData = auditResult.data as { id: string; name: string } | null;

        // Build review summary
        const reviewed = violations.filter((v: any) => v.reviewed_at);
        const reviews = {
            total: violations.length,
            approved: violations.filter((v: any) => v.status === 'approved').length,
            false_positive: violations.filter((v: any) => v.status === 'false_positive').length,
            disputed: violations.filter((v: any) => v.status === 'disputed').length,
            pending: violations.filter((v: any) => v.status === 'pending').length,
            notes: reviewed.map((v: any) => ({
                violation_id: v.id,
                status: v.status,
                note: v.review_note,
                reviewed_by: v.reviewed_by,
                reviewed_at: v.reviewed_at,
            })),
        };

        // Build severity summary
        const bySeverity: Record<string, number> = {};
        for (const v of violations) {
            const s = (v as any).severity ?? 'UNKNOWN';
            bySeverity[s] = (bySeverity[s] ?? 0) + 1;
        }

        // Build by-rule summary
        const byRuleMap = new Map<string, { rule_id: string; rule_name: string; count: number }>();
        for (const v of violations) {
            const key = (v as any).rule_id;
            if (!byRuleMap.has(key)) {
                byRuleMap.set(key, { rule_id: key, rule_name: (v as any).rule_name, count: 0 });
            }
            byRuleMap.get(key)!.count++;
        }

        const generatedAt = new Date().toISOString();

        // Log the export
        try {
            const logRow: Record<string, unknown> = {
                user_id: userId,
                scan_id: targetScanId,
                format,
            };
            if (org) logRow.organization_id = org;
            await supabase.from('export_logs').insert(logRow);
        } catch { /* export_logs table may not exist yet */ }

        const report = {
            generated_at: generatedAt,
            organization: orgData ? { id: orgData.id, name: orgData.name } : null,
            audit: auditData ? { id: auditData.id, name: auditData.name } : null,
            policy: {
                id: policy?.id,
                name: policy?.name,
                type: policy?.type ?? 'unknown',
                rules_count: policy?.rules_count ?? 0,
            },
            scan: {
                id: scan.id,
                status: scan.status,
                compliance_score: scan.compliance_score,
                record_count: scan.record_count,
                violation_count: scan.violation_count,
                created_at: scan.created_at,
                completed_at: scan.completed_at,
            },
            violations,
            reviews,
            summary: {
                total_violations: violations.length,
                by_severity: bySeverity,
                by_rule: [...byRuleMap.values()],
            },
        };

        if (format === 'pdf') {
            const pdfData: PdfReportData = {
                organization: orgData ? { name: orgData.name } : undefined,
                audit: auditData ? { name: auditData.name } : undefined,
                policy: { name: policy?.name ?? 'Unknown Policy', type: policy?.type ?? 'unknown' },
                scan: {
                    id: scan.id,
                    compliance_score: scan.compliance_score ?? 0,
                    record_count: scan.record_count ?? 0,
                    violation_count: scan.violation_count ?? 0,
                    created_at: scan.created_at,
                    completed_at: scan.completed_at,
                },
                violations: violations.map((v: any) => ({
                    rule_id: v.rule_id,
                    rule_name: v.rule_name,
                    severity: v.severity,
                    account: v.account,
                    amount: v.amount,
                    status: v.status,
                    explanation: v.explanation,
                })),
                reviews: {
                    total: reviews.total,
                    approved: reviews.approved,
                    false_positive: reviews.false_positive,
                    disputed: reviews.disputed,
                    pending: reviews.pending,
                },
                summary: { by_severity: bySeverity },
                generated_at: generatedAt,
            };

            const pdfBuf = await generatePdfBuffer(pdfData);
            const shortId = scan.id.slice(0, 8);

            return new NextResponse(pdfBuf, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="yggdrasil-report-${shortId}.pdf"`,
                    'Content-Length': String(pdfBuf.byteLength),
                },
            });
        }

        return NextResponse.json({ report });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('GET /api/export error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, { status: 500 });
    }
}
