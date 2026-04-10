// ============================================================
// POST /api/connectors/:id/preview — Preview data from connector
// Body: { table?: string, query?: string, key?: string, limit?: number }
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
        const body = await request.json();
        const limit = Math.min(Number(body.limit ?? 20), 100);

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
            return await previewPostgres(connector.config, credentials, body.table, limit);
        } else if (connector.type === 's3_csv') {
            return await previewS3(connector.config, credentials, body.key ?? String(connector.config.key ?? ''), limit);
        }

        return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('POST /api/connectors/[id]/preview error:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
}

async function previewPostgres(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    table: string | undefined,
    limit: number
) {
    if (!table) {
        return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'table is required' }, { status: 400 });
    }

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

        const schema = table.includes('.') ? table.split('.')[0] : 'public';
        const tableName = table.includes('.') ? table.split('.')[1] : table;
        const safeTable = `"${escapeIdent(schema)}"."${escapeIdent(tableName)}"`;

        if (!isValidIdentifier(schema) || !isValidIdentifier(tableName)) {
            return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid table identifier' }, { status: 400 });
        }

        const { rows: countResult } = await client.query(`SELECT COUNT(*) AS total FROM ${safeTable}`);
        const total = Number(countResult[0]?.total ?? 0);

        const { rows, fields } = await client.query(`SELECT * FROM ${safeTable} LIMIT $1`, [limit]);
        await client.end();

        return NextResponse.json({
            headers: fields.map((f) => f.name),
            rows,
            total_rows: total,
            preview_rows: rows.length,
        });
    } catch (err) {
        await client.end().catch(() => { });
        return NextResponse.json({
            error: err instanceof Error ? err.message : 'Preview failed',
        }, { status: 500 });
    }
}

async function previewS3(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    key: string,
    limit: number
) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const Papa = (await import('papaparse')).default;

    const s3 = new S3Client({
        region: String(config.region ?? 'us-east-1'),
        credentials: {
            accessKeyId: String(credentials.access_key_id ?? ''),
            secretAccessKey: String(credentials.secret_access_key ?? ''),
        },
    });

    const response = await s3.send(new GetObjectCommand({
        Bucket: String(config.bucket ?? ''),
        Key: key,
        Range: 'bytes=0-524288',
    }));

    const text = await response.Body?.transformToString('utf-8');
    if (!text) {
        return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    const parsed = Papa.parse(text, { header: true, preview: limit });
    return NextResponse.json({
        headers: parsed.meta.fields ?? [],
        rows: parsed.data,
        preview_rows: parsed.data.length,
    });
}

function escapeIdent(s: string): string {
    return s.replace(/"/g, '""');
}

function isValidIdentifier(s: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}
