// ============================================================
// GET  /api/connectors — List connectors for current org
// POST /api/connectors — Create a new connector
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';
import { encryptCredentials, isEncryptionAvailable } from '@/lib/connector-crypto';

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);
        if (!org) {
            return NextResponse.json({ connectors: [] });
        }

        const { data, error } = await ctx.supabase
            .from('connectors')
            .select('id, name, type, config, status, last_tested_at, created_at')
            .eq('organization_id', org)
            .order('created_at', { ascending: false });

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ connectors: [] });
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        return NextResponse.json({ connectors: data ?? [] });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);
        if (!org) {
            return NextResponse.json(
                { error: 'PRECONDITION', message: 'Organization required to create connectors' },
                { status: 422 }
            );
        }

        const body = await request.json();
        const { name, type, config, credentials } = body as {
            name: string;
            type: 'postgres' | 's3_csv';
            config: Record<string, unknown>;
            credentials?: Record<string, unknown>;
        };

        if (!name || !type) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'name and type required' }, { status: 400 });
        }

        const row: Record<string, unknown> = {
            organization_id: org,
            name,
            type,
            config,
            created_by: ctx.userId,
        };

        if (credentials && isEncryptionAvailable()) {
            row.credentials_enc = encryptCredentials(JSON.stringify(credentials));
        }

        const { data, error } = await ctx.supabase
            .from('connectors')
            .insert(row)
            .select('id, name, type, config, status, created_at')
            .single();

        if (error) {
            return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('POST /api/connectors error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}
