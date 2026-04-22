// ============================================================
// Org Store — current organization context for the authenticated user
// ============================================================

import { create } from 'zustand';
import { api } from '@/lib/api';

interface Organization {
    id: string;
    name: string;
    slug: string;
    created_at: string;
}

interface OrgState {
    currentOrg: Organization | null;
    role: string | null;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    fetchCurrentOrg: () => Promise<void>;
    clear: () => void;
}

export const useOrgStore = create<OrgState>((set, get) => ({
    currentOrg: null,
    role: null,
    isLoading: false,
    isInitialized: false,
    error: null,

    fetchCurrentOrg: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
            const data = await api.get<{
                organization: Organization | null;
                role: string;
                message?: string;
            }>('/organizations/current');

            set({
                currentOrg: data.organization,
                role: data.role,
                isLoading: false,
                isInitialized: true,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load organization',
                isLoading: false,
                isInitialized: true,
            });
        }
    },

    clear: () =>
        set({
            currentOrg: null,
            role: null,
            isLoading: false,
            isInitialized: false,
            error: null,
        }),
}));
