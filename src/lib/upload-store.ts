// ============================================================
// Upload store with durable-first persistence + in-memory fallback
// ============================================================

import type { NextRequest } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest } from '@/lib/supabase';

export interface DatasetMetadata {
    columnStats: Record<string, {
        min?: number;
        max?: number;
        mean?: number;
        cardinality: number;
        type: 'numeric' | 'categorical' | 'text';
    }>;
    totalRows: number;
}

export type UploadData = {
    rows: Record<string, any>[];
    headers: string[];
    fileName: string;
    metadata?: DatasetMetadata;
};

type SupabaseContext = {
    supabase: Awaited<ReturnType<typeof getSupabaseForRequest>>;
    userId: string;
};

const globalForUpload = globalThis as unknown as {
    uploadStore: Map<string, UploadData> | undefined;
};

// Fast cache for current runtime. Durable writes happen via Supabase helpers below.
export const uploadStore = globalForUpload.uploadStore ?? new Map<string, UploadData>();

if (process.env.NODE_ENV !== 'production') {
    globalForUpload.uploadStore = uploadStore;
}

const UPLOADS_TABLE = 'uploaded_datasets';

function computeDatasetMetadata(
    rows: Record<string, any>[],
    headers: string[]
): DatasetMetadata {
    const metadata: DatasetMetadata = {
        totalRows: rows.length,
        columnStats: {},
    };

    for (const header of headers) {
        const values = rows
            .map((row) => row[header])
            .filter((value) => value !== null && value !== undefined && value !== '');
        const numericValues = values
            .map((value) => (typeof value === 'number' ? value : Number(value)))
            .filter((value) => Number.isFinite(value));
        const isNumeric = values.length > 0 && numericValues.length === values.length;
        const uniqueValues = new Set(values.map((value) => String(value)));

        metadata.columnStats[header] = {
            type: isNumeric ? 'numeric' : 'categorical',
            cardinality: uniqueValues.size,
            ...(isNumeric && numericValues.length > 0
                ? {
                      min: Math.min(...numericValues),
                      max: Math.max(...numericValues),
                      mean: numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length,
                  }
                : {}),
        };
    }

    return metadata;
}

async function getSupabaseContext(
    request: NextRequest,
): Promise<SupabaseContext | null> {
    try {
        const [supabase, userId] = await Promise.all([
            getSupabaseForRequest(request),
            getUserIdFromRequest(request),
        ]);
        return { supabase, userId };
    } catch {
        return null;
    }
}

function isMissingTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    const message =
        'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
    return code === '42P01' || message.toLowerCase().includes('does not exist');
}

export async function saveUpload(
    request: NextRequest,
    uploadId: string,
    data: UploadData,
    organizationId?: string,
): Promise<void> {
    const uploadData: UploadData = {
        ...data,
        metadata: data.metadata ?? computeDatasetMetadata(data.rows, data.headers),
    };

    uploadStore.set(uploadId, uploadData);

    const ctx = await getSupabaseContext(request);
    if (!ctx) return;

    const { error } = await ctx.supabase.from(UPLOADS_TABLE).upsert(
        {
            id: uploadId,
            user_id: ctx.userId,
            ...(organizationId ? { organization_id: organizationId } : {}),
            file_name: uploadData.fileName,
            headers: uploadData.headers,
            rows: uploadData.rows,
            row_count: uploadData.rows.length,
        },
        { onConflict: 'id' },
    );

    if (error && !isMissingTableError(error)) {
        console.error('[upload-store] Failed to persist upload:', error);
    }
}

export async function getUpload(
    request: NextRequest,
    uploadId: string,
): Promise<UploadData | null> {
    const cached = uploadStore.get(uploadId);
    if (cached) return cached;

    const ctx = await getSupabaseContext(request);
    if (!ctx) return null;

    const { data, error } = await ctx.supabase
        .from(UPLOADS_TABLE)
        .select('id, file_name, headers, rows')
        .eq('id', uploadId)
        .single();

    if (error) {
        if (!isMissingTableError(error)) {
            console.error('[upload-store] Failed to load upload:', error);
        }
        return null;
    }

    const record: UploadData = {
        fileName:
            typeof data?.file_name === 'string' && data.file_name.length > 0
                ? data.file_name
                : 'uploaded.csv',
        headers: Array.isArray(data?.headers) ? (data.headers as string[]) : [],
        rows: Array.isArray(data?.rows) ? (data.rows as Record<string, any>[]) : [],
        metadata: computeDatasetMetadata(
            Array.isArray(data?.rows) ? (data.rows as Record<string, any>[]) : [],
            Array.isArray(data?.headers) ? (data.headers as string[]) : []
        ),
    };

    uploadStore.set(uploadId, record);
    return record;
}

export async function hasUpload(
    request: NextRequest,
    uploadId: string,
): Promise<boolean> {
    if (uploadStore.has(uploadId)) return true;

    const ctx = await getSupabaseContext(request);
    if (!ctx) return false;

    const { data, error } = await ctx.supabase
        .from(UPLOADS_TABLE)
        .select('id')
        .eq('id', uploadId)
        .maybeSingle();

    if (error) {
        if (!isMissingTableError(error)) {
            console.error('[upload-store] Failed to check upload existence:', error);
        }
        return false;
    }

    return Boolean(data?.id);
}
