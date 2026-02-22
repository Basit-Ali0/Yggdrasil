// ============================================================
// In-memory upload store — shared across API routes
// In production this would be Redis/S3, but for hackathon this works
// ============================================================

// Global cache to survive Next.js dev hot-reloads
type UploadData = {
    rows: Record<string, any>[];
    headers: string[];
    fileName: string;
    metadata?: DatasetMetadata;
};

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

const globalForUpload = globalThis as unknown as {
    uploadStore: Map<string, UploadData> | undefined;
};

export const uploadStore = globalForUpload.uploadStore ?? new Map<string, UploadData>();

if (process.env.NODE_ENV !== 'production') {
    globalForUpload.uploadStore = uploadStore;
}
