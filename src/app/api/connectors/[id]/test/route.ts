// ============================================================
// POST /api/connectors/:id/test — Test connector connectivity
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext } from '@/lib/org-context';
import { decryptCredentials } from '@/lib/connector-crypto';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);

        const { data: connector, error } = await ctx.supabase
            .from('connectors')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !connector) {
            return NextResponse.json({ error: 'NOT_FOUND', message: 'Connector not found' }, { status: 404 });
        }

        let credentials: Record<string, unknown> = {};
        if (connector.credentials_enc) {
            try {
                credentials = JSON.parse(decryptCredentials(Buffer.from(connector.credentials_enc)));
            } catch {
                return NextResponse.json({
                    ok: false,
                    error: 'Failed to decrypt credentials',
                }, { status: 500 });
            }
        }

        if (connector.type === 'postgres') {
            return await testPostgres(connector.config, credentials, ctx, id);
        } else if (connector.type === 's3_csv') {
            return await testS3(connector.config, credentials, ctx, id);
        }

        return NextResponse.json({ ok: false, error: `Unsupported type: ${connector.type}` }, { status: 400 });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('POST /api/connectors/[id]/test error:', err);
        return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
    }
}

async function testPostgres(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    ctx: { supabase: any },
    connectorId: string
) {
    try {
        const { Client } = await import('pg');
        const client = new Client({
            host: String(config.host ?? 'localhost'),
            port: Number(config.port ?? 5432),
            database: String(config.database ?? ''),
            user: String(credentials.user ?? ''),
            password: String(credentials.password ?? ''),
            ssl: config.ssl ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 10000,
        });

        await client.connect();
        const result = await client.query('SELECT 1 AS ok');
        await client.end();

        await ctx.supabase
            .from('connectors')
            .update({ last_tested_at: new Date().toISOString(), status: 'active' })
            .eq('id', connectorId);

        return NextResponse.json({ ok: true, message: 'Connected successfully' });
    } catch (err) {
        await ctx.supabase
            .from('connectors')
            .update({ status: 'error' })
            .eq('id', connectorId);

        return NextResponse.json({
            ok: false,
            error: err instanceof Error ? err.message : 'Connection failed',
        });
    }
}

async function testS3(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    ctx: { supabase: any },
    connectorId: string
) {
    try {
        const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
            region: String(config.region ?? 'us-east-1'),
            credentials: {
                accessKeyId: String(credentials.access_key_id ?? ''),
                secretAccessKey: String(credentials.secret_access_key ?? ''),
            },
        });

        await s3.send(new HeadObjectCommand({
            Bucket: String(config.bucket ?? ''),
            Key: String(config.key ?? ''),
        }));

        await ctx.supabase
            .from('connectors')
            .update({ last_tested_at: new Date().toISOString(), status: 'active' })
            .eq('id', connectorId);

        return NextResponse.json({ ok: true, message: 'S3 object accessible' });
    } catch (err) {
        await ctx.supabase
            .from('connectors')
            .update({ status: 'error' })
            .eq('id', connectorId);

        return NextResponse.json({
            ok: false,
            error: err instanceof Error ? err.message : 'S3 access failed',
        });
    }
}
