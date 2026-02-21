// ============================================================
// In-memory mapping store — shared across API routes
// ============================================================

// Global cache to survive Next.js dev hot-reloads
type MappingData = {
    upload_id: string;
    mapping_config: Record<string, string>;
    temporal_scale: number;
    clarification_answers?: Array<{ question_id: string; answer: string }>;
};

const globalForMapping = globalThis as unknown as {
    mappingStore: Map<string, MappingData> | undefined;
};

export const mappingStore = globalForMapping.mappingStore ?? new Map<string, MappingData>();

if (process.env.NODE_ENV !== 'production') {
    globalForMapping.mappingStore = mappingStore;
}
