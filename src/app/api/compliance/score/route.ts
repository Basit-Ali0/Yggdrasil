// ============================================================
// GET /api/compliance/score — Get compliance score for a scan
// Returns ComplianceScoreResponse per contracts.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const supabase = await getSupabaseForRequest(request);
        const { searchParams } = new URL(request.url);
        const scanId = searchParams.get('scan_id');

        if (!scanId) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'scan_id is required' },
                { status: 400 }
            );
        }

        const { data: scan } = await supabase
            .from('scans')
            .select('*')
            .eq('id', scanId)
            .single();

        if (!scan) {
            return NextResponse.json(
                { error: 'NOT_FOUND', message: 'Scan not found' },
                { status: 404 }
            );
        }

        const { data: violations } = await supabase
            .from('violations')
            .select('severity, status, rule_id')
            .eq('scan_id', scanId);

        const allViols = violations ?? [];
        const active = allViols.filter((v: any) => v.status !== 'false_positive');
        const falsePositives = allViols.filter((v: any) => v.status === 'false_positive').length;
        const resolved = allViols.filter((v: any) => v.status === 'approved' || v.status === 'false_positive').length;
        const open = allViols.length - resolved;

        // by_severity — UPPERCASE keys to match dashboard reads
        const bySeverity: Record<string, number> = {
            CRITICAL: active.filter((v: any) => v.severity === 'CRITICAL').length,
            HIGH: active.filter((v: any) => v.severity === 'HIGH').length,
            MEDIUM: active.filter((v: any) => v.severity === 'MEDIUM').length,
        };

        // by_rule_type — group active violations by rule_id
        const byRuleType: Record<string, number> = {};
        for (const v of active) {
            const ruleId = (v as any).rule_id ?? 'UNKNOWN';
            byRuleType[ruleId] = (byRuleType[ruleId] ?? 0) + 1;
        }

        return NextResponse.json({
            score: scan.compliance_score ?? 0,
            total_violations: allViols.length,
            open_violations: open,
            resolved_violations: resolved,
            false_positives: falsePositives,
            by_severity: bySeverity,
            by_rule_type: byRuleType,
        });

    } catch (err) {
        console.error('GET /api/compliance/score error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

