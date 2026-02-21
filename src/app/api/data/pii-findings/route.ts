// ============================================================
// GET /api/data/pii-findings — Fetch PII findings for a scan
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const scanId = searchParams.get('scan_id');
        const uploadId = searchParams.get('upload_id');

        if (!scanId && !uploadId) {
            return NextResponse.json(
                { error: 'Bad Request', message: 'scan_id or upload_id is required' },
                { status: 400 },
            );
        }

        const supabase = getSupabase();

        let query = supabase.from('pii_findings').select('*');

        if (scanId) {
            query = query.eq('scan_id', scanId);
        } else if (uploadId) {
            query = query.eq('upload_id', uploadId);
        }

        query = query.order('severity', { ascending: true }).order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('[PII Findings] Supabase query error:', error);
            return NextResponse.json(
                { error: 'Internal Server Error', message: 'Failed to fetch PII findings' },
                { status: 500 },
            );
        }

        const findings = data ?? [];

        return NextResponse.json({
            findings,
            pii_detected: findings.some((f) => f.status === 'open'),
        });
    } catch (err) {
        console.error('[PII Findings] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal Server Error', message: 'Failed to fetch PII findings' },
            { status: 500 },
        );
    }
}
