// ============================================================
// GET /api/violations — List violations with filtering
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForRequest } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const supabase = await getSupabaseForRequest(request);
        const { searchParams } = new URL(request.url);

        const scanId = searchParams.get('scan_id');
        const severity = searchParams.get('severity');
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') ?? '1', 10);
        const limit = parseInt(searchParams.get('limit') ?? '20', 10);

        let query = supabase
            .from('violations')
            .select('*', { count: 'exact' });

        if (scanId) query = query.eq('scan_id', scanId);
        if (severity) query = query.eq('severity', severity);
        if (status) query = query.eq('status', status);

        // Pagination
        const from = (page - 1) * limit;
        query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

        const { data: violations, error, count } = await query;

        if (error) {
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to fetch violations' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            violations: violations ?? [],
            pagination: {
                page,
                limit,
                total: count ?? 0,
                pages: Math.ceil((count ?? 0) / limit),
            },
        });

    } catch (err) {
        console.error('GET /api/violations error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
