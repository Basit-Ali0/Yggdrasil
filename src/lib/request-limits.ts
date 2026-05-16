export const DEFAULT_POSTGRES_IMPORT_LIMIT = 50000;
export const MAX_POSTGRES_IMPORT_LIMIT = 100000;

export function clampImportLimit(value: unknown): number {
    const parsed = Number(value ?? DEFAULT_POSTGRES_IMPORT_LIMIT);
    if (!Number.isFinite(parsed)) return DEFAULT_POSTGRES_IMPORT_LIMIT;
    return Math.max(1, Math.min(MAX_POSTGRES_IMPORT_LIMIT, Math.trunc(parsed)));
}

export function parseOrganizationEventsLimit(rawLimit: string | null): number {
    const parsed = Number(rawLimit ?? 50);
    if (!Number.isFinite(parsed) || parsed < 1) return 50;
    return Math.min(Math.trunc(parsed), 100);
}
