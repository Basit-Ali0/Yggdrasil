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
    clearError: () => void;
    reset: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchScanStatus(scanId: string): Promise<ScanStatusResponse> {
    return api.get<ScanStatusResponse>(`/scan/${scanId}`);
}

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

        const checkStatus = async () => {
            try {
                const data = await fetchScanStatus(scanId);
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
        };

        pollInterval = setInterval(async () => {
            await checkStatus();
        }, 1000);

        void checkStatus();
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

    clearError: () => set({ error: null }),
    reset: () => {
        get().stopPolling();
        set({ currentScan: null, scanHistory: [], isPolling: false, error: null });
    },
}));
