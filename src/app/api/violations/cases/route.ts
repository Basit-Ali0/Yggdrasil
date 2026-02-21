// ============================================================
// GET /api/violations/cases — Violations grouped by account
// Response per CONTRACTS.md Screen 7
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const { searchParams } = new URL(request.url);
        const scanId = searchParams.get('scan_id');

        if (!scanId) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'scan_id is required' },
                { status: 400 }
            );
        }

        // Fetch all violations for this scan
        let query = supabase
            .from('violations')
            .select('*')
            .eq('scan_id', scanId);

        const severityFilter = searchParams.get('severity');
        if (severityFilter) {
            query = query.eq('severity', severityFilter);
        }

        const { data: violations, error } = await query;

        if (error) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch violations' },
                { status: 500 }
            );
        }

        // Group by account
        const caseMap = new Map<string, any>();

        for (const v of violations ?? []) {
            const accountId = v.account ?? 'UNKNOWN';
            if (!caseMap.has(accountId)) {
                caseMap.set(accountId, {
                    account_id: accountId,
                    violation_count: 0,
                    max_severity: 'MEDIUM',
                    top_rule: '',
                    total_amount: 0,
                    violations: [],
                });
            }

            const c = caseMap.get(accountId)!;
            c.violation_count++;
            c.total_amount += parseFloat(v.amount ?? 0);
            c.violations.push({
                id: v.id,
                rule_id: v.rule_id,
                severity: v.severity,
                amount: parseFloat(v.amount ?? 0),
                explanation: v.explanation,
            });

            // Update max severity
            const severityOrder = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
            const currentMax = severityOrder[c.max_severity as keyof typeof severityOrder] ?? 0;
            const newSev = severityOrder[v.severity as keyof typeof severityOrder] ?? 0;
            if (newSev > currentMax) {
                c.max_severity = v.severity;
                c.top_rule = v.rule_id;
            }
            if (!c.top_rule) c.top_rule = v.rule_id;
        }

        const cases = Array.from(caseMap.values());

        // Get compliance score for this scan
        const { data: scan } = await supabase
            .from('scans')
            .select('compliance_score')
            .eq('id', scanId)
            .single();

        return NextResponse.json({
            cases,
            total_cases: cases.length,
            total_violations: violations?.length ?? 0,
            compliance_score: scan?.compliance_score ?? 0,
        });

    } catch (err) {
        console.error('GET /api/violations/cases error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
