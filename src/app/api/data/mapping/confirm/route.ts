// ============================================================
// POST /api/data/mapping/confirm — Confirm column mapping
// Response: { mapping_id, ready_to_scan: true } per CONTRACTS.md
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { ConfirmMappingSchema } from '@/lib/validators';
import { v4 as uuid } from 'uuid';

// In-memory store for confirmed mappings
// NOTE: Do not `export` this from a route file (Next.js only allows HTTP method exports).
// Other routes import from '@/lib/mapping-store' instead.
import { mappingStore } from '@/lib/mapping-store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = ConfirmMappingSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { upload_id, mapping_config, temporal_scale } = parsed.data;

        const mappingId = uuid();
        mappingStore.set(mappingId, {
            upload_id,
            mapping_config,
            temporal_scale,
        });

        return NextResponse.json({
            mapping_id: mappingId,
            ready_to_scan: true,
        });

    } catch (err) {
        console.error('POST /api/data/mapping/confirm error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
