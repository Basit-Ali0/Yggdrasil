// ============================================================
// POST /api/connectors/:id/discover — Discover schemas/tables/keys
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
            return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
        }

        let credentials: Record<string, unknown> = {};
        if (connector.credentials_enc) {
            credentials = JSON.parse(decryptCredentials(Buffer.from(connector.credentials_enc)));
        }

        if (connector.type === 'postgres') {
            return await discoverPostgres(connector.config, credentials);
        } else if (connector.type === 's3_csv') {
            return await discoverS3(connector.config, credentials);
        }

        return NextResponse.json({ error: 'Unsupported connector type' }, { status: 400 });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('POST /api/connectors/[id]/discover error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

async function discoverPostgres(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
) {
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

    try {
        await client.connect();
        const { rows } = await client.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
            LIMIT 200
        `);
        await client.end();

        const schemas = new Map<string, string[]>();
        for (const row of rows) {
            const schema = row.table_schema;
            if (!schemas.has(schema)) schemas.set(schema, []);
            schemas.get(schema)!.push(row.table_name);
        }

        return NextResponse.json({
            schemas: [...schemas.entries()].map(([name, tables]) => ({
                name,
                tables,
            })),
        });
    } catch (err) {
        await client.end().catch(() => { });
        return NextResponse.json({
            error: err instanceof Error ? err.message : 'Discovery failed',
        }, { status: 500 });
    }
}

async function discoverS3(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
) {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
        region: String(config.region ?? 'us-east-1'),
        credentials: {
            accessKeyId: String(credentials.access_key_id ?? ''),
            secretAccessKey: String(credentials.secret_access_key ?? ''),
        },
    });

    const prefix = String(config.prefix ?? '');
    const { Contents } = await s3.send(new ListObjectsV2Command({
        Bucket: String(config.bucket ?? ''),
        Prefix: prefix,
        MaxKeys: 100,
    }));

    const files = (Contents ?? [])
        .filter((obj) => obj.Key?.endsWith('.csv'))
        .map((obj) => ({
            key: obj.Key!,
            size: obj.Size ?? 0,
            last_modified: obj.LastModified?.toISOString() ?? null,
        }));

    return NextResponse.json({ files });
}
