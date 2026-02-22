// ============================================================
// Scan Store — Yggdrasil
// Manages scan polling lifecycle + history
// ============================================================

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { ScanStatusResponse, ScanHistoryResponse, ScanHistoryEntry } from '@/lib/contracts';

interface ScanState {
    currentScan: ScanStatusResponse | null;
    scanHistory: ScanHistoryEntry[];
    isPolling: boolean;
    isLoadingHistory: boolean;
    error: string | null;

    // Actions
    pollScanStatus: (scanId: string, onComplete: (scan: ScanStatusResponse) => void) => void;
    stopPolling: () => void;
    fetchHistory: () => Promise<void>;
    deleteScan: (scanId: string) => Promise<void>;
    clearError: () => void;
    reset: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useScanStore = create<ScanState>((set, get) => ({
    currentScan: null,
    scanHistory: [],
    isPolling: false,
    isLoadingHistory: false,
    error: null,

    pollScanStatus: (scanId, onComplete) => {
        // Clear any existing poll
        if (pollInterval) clearInterval(pollInterval);

        set({ isPolling: true, error: null });

        pollInterval = setInterval(async () => {
            try {
                const data = await api.get<ScanStatusResponse>(`/scan/${scanId}`);
                set({ currentScan: data });

                if (data.status === 'completed' || data.status === 'failed') {
                    get().stopPolling();
                    onComplete(data);
                }
            } catch (err) {
                set({
                    error: err instanceof Error ? err.message : 'Failed to check scan status',
                });
                get().stopPolling();
            }
        }, 1000);
    },

    stopPolling: () => {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        set({ isPolling: false });
    },

    fetchHistory: async () => {
        set({ isLoadingHistory: true, error: null });
        try {
            const data = await api.get<ScanHistoryResponse>('/scan/history');
            set({ scanHistory: data.scans, isLoadingHistory: false });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load history',
                isLoadingHistory: false,
            });
        }
    },

    deleteScan: async (scanId) => {
        try {
            await api.delete(`/scan/${scanId}`);
            set((state) => ({
                scanHistory: state.scanHistory.filter((s) => s.id !== scanId),
            }));
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to delete scan',
            });
            throw err;
        }
    },

    clearError: () => set({ error: null }),
    reset: () => {
        get().stopPolling();
        set({ currentScan: null, scanHistory: [], isPolling: false, error: null });
    },
}));
