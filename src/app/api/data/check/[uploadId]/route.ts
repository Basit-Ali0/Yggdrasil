// ============================================================
// GET /api/data/check/[uploadId] — Check if upload data is still available
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { hasUpload } from '@/lib/upload-store';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ uploadId: string }> }
) {
    try {
        const { uploadId } = await params;

        const available = await hasUpload(request, uploadId);

        return NextResponse.json({ available });

    } catch (err) {
        console.error('GET /api/data/check/[uploadId] error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
