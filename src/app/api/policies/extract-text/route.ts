// ============================================================
// POST /api/policies/extract-text — PDF text extraction only
// Returns extracted text for progressive UI display
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError, getUserIdFromRequest } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        // Ensure user is authenticated
        await getUserIdFromRequest(request);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'No PDF file provided' },
                { status: 400 }
            );
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'File must be a PDF' },
                { status: 400 }
            );
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'PDF must be under 10 MB' },
                { status: 400 }
            );
        }

        let pdfText = '';
        try {
            const { getDocumentProxy, extractText } = await import('unpdf');
            const buffer = await file.arrayBuffer();
            const pdf = await getDocumentProxy(new Uint8Array(buffer));
            const { text } = await extractText(pdf, { mergePages: true });
            pdfText = text;
        } catch (pdfErr) {
            console.error('PDF parsing error:', pdfErr);
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Failed to parse PDF. Ensure the file is a valid, non-encrypted PDF.' },
                { status: 400 }
            );
        }

        if (!pdfText.trim()) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'PDF contains no extractable text. It may be a scanned image.' },
                { status: 400 }
            );
        }

        console.log(`[extract-text] PDF text extracted: ${pdfText.length} chars`);

        return NextResponse.json({
            text: pdfText,
            char_count: pdfText.length,
        });

    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json(
                { error: 'UNAUTHORIZED', message: err.message },
                { status: 401 }
            );
        }
        console.error('POST /api/policies/extract-text error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
