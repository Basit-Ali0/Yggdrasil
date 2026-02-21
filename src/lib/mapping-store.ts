// ============================================================
// In-memory mapping store — shared across API routes
// ============================================================

export const mappingStore = new Map<string, {
    upload_id: string;
    mapping_config: Record<string, string>;
    temporal_scale: number;
}>();
