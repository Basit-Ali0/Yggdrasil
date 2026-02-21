// ============================================================
// PII Store — Yggdrasil
// Manages PII scanning state + finding resolution
// ============================================================

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { PIIExecutionResult } from '@/lib/engine/pii-executor';

interface PIIFinding extends PIIExecutionResult {
    id?: string;
    status?: string;
}

interface PIIScanResponse {
    findings: PIIFinding[];
    summary: string;
    pii_detected: boolean;
}

interface PIIFindingsResponse {
    findings: PIIFinding[];
    pii_detected: boolean;
}

interface PIIState {
    findings: PIIFinding[];
    summary: string;
    piiDetected: boolean;
    isScanning: boolean;
    isLoading: boolean;
    error: string | null;

    scanForPII: (uploadId: string, scanId?: string) => Promise<void>;
    fetchFindings: (scanId: string) => Promise<void>;
    resolveFinding: (findingId: string, status: 'resolved' | 'ignored') => Promise<void>;
    reset: () => void;
}

const initialState = {
    findings: [] as PIIFinding[],
    summary: '',
    piiDetected: false,
    isScanning: false,
    isLoading: false,
    error: null as string | null,
};

export const usePIIStore = create<PIIState>((set, get) => ({
    ...initialState,

    scanForPII: async (uploadId, scanId) => {
        set({ isScanning: true, error: null });
        try {
            const data = await api.post<PIIScanResponse>('/data/pii-scan', {
                upload_id: uploadId,
                scan_id: scanId,
            });
            set({
                findings: data.findings,
                summary: data.summary,
                piiDetected: data.pii_detected,
                isScanning: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'PII scan failed',
                isScanning: false,
            });
        }
    },

    fetchFindings: async (scanId) => {
        set({ isLoading: true, error: null });
        try {
            const data = await api.get<PIIFindingsResponse>(
                `/data/pii-findings?scan_id=${encodeURIComponent(scanId)}`,
            );
            set({
                findings: data.findings,
                piiDetected: data.pii_detected,
                isLoading: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to fetch PII findings',
                isLoading: false,
            });
        }
    },

    resolveFinding: async (findingId, status) => {
        try {
            await api.patch(`/data/pii-findings/${findingId}`, { status });

            // Update local state
            const findings = get().findings.map((f) =>
                f.id === findingId ? { ...f, status } : f,
            );
            const piiDetected = findings.some(
                (f) => f.status !== 'resolved' && f.status !== 'ignored',
            );
            set({ findings, piiDetected });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to resolve finding',
            });
        }
    },

    reset: () => set(initialState),
}));
