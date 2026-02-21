// ============================================================
// In-memory upload store — shared across API routes
// In production this would be Redis/S3, but for hackathon this works
// ============================================================

export const uploadStore = new Map<string, {
    rows: Record<string, any>[];
    headers: string[];
    fileName: string;
}>();
