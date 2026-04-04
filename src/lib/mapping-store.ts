// ============================================================
// Mapping store with durable-first persistence + in-memory fallback
// ============================================================

import type { NextRequest } from 'next/server';
import { getSupabaseForRequest, getUserIdFromRequest } from '@/lib/supabase';

export type MappingData = {
    upload_id: string;
    mapping_config: Record<string, string>;
    temporal_scale: number;
    clarification_answers?: Array<{ question_id: string; answer: string }>;
};

type SupabaseContext = {
    supabase: Awaited<ReturnType<typeof getSupabaseForRequest>>;
    userId: string;
};

const globalForMapping = globalThis as unknown as {
    mappingStore: Map<string, MappingData> | undefined;
};

// Fast cache for current runtime. Durable writes happen via Supabase helpers below.
export const mappingStore = globalForMapping.mappingStore ?? new Map<string, MappingData>();

if (process.env.NODE_ENV !== 'production') {
    globalForMapping.mappingStore = mappingStore;
}

const MAPPINGS_TABLE = 'mapping_configs';

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

export async function saveMapping(
    request: NextRequest,
    mappingId: string,
    data: MappingData,
    organizationId?: string,
): Promise<void> {
    mappingStore.set(mappingId, data);

    const ctx = await getSupabaseContext(request);
    if (!ctx) return;

    const { error } = await ctx.supabase.from(MAPPINGS_TABLE).upsert(
        {
            id: mappingId,
            user_id: ctx.userId,
            ...(organizationId ? { organization_id: organizationId } : {}),
            upload_id: data.upload_id,
            mapping_config: data.mapping_config,
            temporal_scale: data.temporal_scale,
            clarification_answers: data.clarification_answers ?? [],
        },
        { onConflict: 'id' },
    );

    if (error && !isMissingTableError(error)) {
        console.error('[mapping-store] Failed to persist mapping:', error);
    }
}

export async function getMapping(
    request: NextRequest,
    mappingId: string,
): Promise<MappingData | null> {
    const cached = mappingStore.get(mappingId);
    if (cached) return cached;

    const ctx = await getSupabaseContext(request);
    if (!ctx) return null;

    const { data, error } = await ctx.supabase
        .from(MAPPINGS_TABLE)
        .select('id, upload_id, mapping_config, temporal_scale, clarification_answers')
        .eq('id', mappingId)
        .single();

    if (error) {
        if (!isMissingTableError(error)) {
            console.error('[mapping-store] Failed to load mapping:', error);
        }
        return null;
    }

    const record: MappingData = {
        upload_id: typeof data?.upload_id === 'string' ? data.upload_id : '',
        mapping_config:
            data?.mapping_config && typeof data.mapping_config === 'object'
                ? (data.mapping_config as Record<string, string>)
                : {},
        temporal_scale:
            typeof data?.temporal_scale === 'number'
                ? data.temporal_scale
                : Number(data?.temporal_scale ?? 1),
        clarification_answers: Array.isArray(data?.clarification_answers)
            ? (data.clarification_answers as Array<{ question_id: string; answer: string }>)
            : [],
    };

    mappingStore.set(mappingId, record);
    return record;
}
