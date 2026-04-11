// ============================================================
// POST /api/connectors/:id/import — Import data into upload pipeline
// Body: { table?: string, key?: string, audit_id?: string }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from '@/lib/supabase';
import { resolveOrgContext, orgFilter } from '@/lib/org-context';
import { decryptCredentials } from '@/lib/connector-crypto';
import { saveUpload } from '@/lib/upload-store';
import { v4 as uuid } from 'uuid';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const ctx = await resolveOrgContext(request);
        const org = orgFilter(ctx);
        const body = await request.json();

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

        let rows: Record<string, unknown>[] = [];
        let headers: string[] = [];
        let fileName: string;
        let totalRows: number;

        if (connector.type === 'postgres') {
            const result = await importFromPostgres(connector.config, credentials, body.table);
            rows = result.rows;
            headers = result.headers;
            fileName = `pg-${body.table ?? 'query'}.csv`;
            totalRows = rows.length;
        } else if (connector.type === 's3_csv') {
            const key = body.key ?? String(connector.config.key ?? '');
            const result = await importFromS3(connector.config, credentials, key);
            rows = result.rows;
            headers = result.headers;
            fileName = key.split('/').pop() ?? 's3-import.csv';
            totalRows = rows.length;
        } else {
            return NextResponse.json({ error: 'Unsupported connector type' }, { status: 400 });
        }

        const uploadId = uuid();
        try {
            await saveUpload(request, uploadId, { rows, headers, fileName }, org ?? undefined);
        } catch (saveErr) {
            console.error('[connectors/import] saveUpload failed:', saveErr);
            return NextResponse.json(
                { error: 'INTERNAL_ERROR', message: 'Failed to persist uploaded data' },
                { status: 500 }
            );
        }

        // Link to audit if provided
        if (body.audit_id) {
            try {
                await ctx.supabase.from('audits').update({
                    upload_id: uploadId,
                    data_source: connector.type,
                    connector_id: id,
                    updated_at: new Date().toISOString(),
                }).eq('id', body.audit_id);
            } catch { /* audits table may not exist */ }
        }

        return NextResponse.json({
            upload_id: uploadId,
            row_count: totalRows,
            headers,
            file_name: fileName,
            source: connector.type,
            connector_id: id,
        }, { status: 201 });
    } catch (err) {
        if (err instanceof AuthError) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
        console.error('POST /api/connectors/[id]/import error:', err);
        return NextResponse.json({
            error: 'INTERNAL_ERROR',
            message: err instanceof Error ? err.message : 'Import failed',
        }, { status: 500 });
    }
}

async function importFromPostgres(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    table: string | undefined
): Promise<{ rows: Record<string, unknown>[]; headers: string[] }> {
    if (!table) throw new Error('table is required for Postgres import');

    const { Client } = await import('pg');
    const client = new Client({
        host: String(config.host ?? 'localhost'),
        port: Number(config.port ?? 5432),
        database: String(config.database ?? ''),
        user: String(credentials.user ?? ''),
        password: String(credentials.password ?? ''),
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 30000,
        query_timeout: 120000,
    });

    try {
        await client.connect();

        const schema = table.includes('.') ? table.split('.')[0] : 'public';
        const tableName = table.includes('.') ? table.split('.')[1] : table;

        if (!isValidIdentifier(schema) || !isValidIdentifier(tableName)) {
            await client.end().catch(() => { });
            throw new Error('Invalid table identifier');
        }

        const safeTable = `"${escapeIdent(schema)}"."${escapeIdent(tableName)}"`;

        const { rows, fields } = await client.query(`SELECT * FROM ${safeTable}`);
        await client.end();

        return {
            rows,
            headers: fields.map((f) => f.name),
        };
    } catch (err) {
        await client.end().catch(() => { });
        throw err;
    }
}

async function importFromS3(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    key: string
): Promise<{ rows: Record<string, unknown>[]; headers: string[] }> {
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
    }));

    const text = await response.Body?.transformToString('utf-8');
    if (!text) throw new Error('Empty S3 object');

    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    return {
        rows: parsed.data as Record<string, unknown>[],
        headers: parsed.meta.fields ?? [],
    };
}

function escapeIdent(s: string): string {
    return s.replace(/"/g, '""');
}

function isValidIdentifier(s: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}
