// ============================================================
// Policy Store — Yggdrasil
// Manages policy rules: fetch, toggle, delete, add prebuilt/PDF
// ============================================================

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Rule } from '@/lib/types';

interface PolicyData {
    id: string;
    name: string;
    type: string;
    rules_count: number;
    rules: Rule[];
    dirty: boolean;
    updated_at: string;
}

interface PolicyState {
    policy: PolicyData | null;
    isDirty: boolean;
    isLoading: boolean;
    isUpdating: boolean;
    error: string | null;

    fetchPolicy: (policyId: string) => Promise<void>;
    toggleRule: (policyId: string, ruleId: string, isActive: boolean) => Promise<void>;
    deleteRule: (policyId: string, ruleId: string) => Promise<void>;
    addPrebuiltRules: (policyId: string, policyType: string, categories?: string[]) => Promise<void>;
    addPdfRules: (policyId: string, file: File) => Promise<void>;
    reset: () => void;
}

const initialState = {
    policy: null as PolicyData | null,
    isDirty: false,
    isLoading: false,
    isUpdating: false,
    error: null as string | null,
};

export const usePolicyStore = create<PolicyState>((set, get) => ({
    ...initialState,

    fetchPolicy: async (policyId) => {
        set({ isLoading: true, error: null });
        try {
            const data = await api.get<PolicyData>(`/policies/${policyId}`);
            set({
                policy: data,
                isDirty: data.dirty,
                isLoading: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to fetch policy',
                isLoading: false,
            });
        }
    },

    toggleRule: async (policyId, ruleId, isActive) => {
        const { policy } = get();
        if (!policy) return;

        // Optimistic update
        const updatedRules = policy.rules.map((r) =>
            r.rule_id === ruleId ? { ...r, is_active: isActive } : r,
        );
        set({
            policy: { ...policy, rules: updatedRules },
            isDirty: true,
            isUpdating: true,
        });

        try {
            await api.patch<{ success: boolean }>(`/policies/${policyId}/rules`, {
                rule_id: ruleId,
                is_active: isActive,
            });
            set({ isUpdating: false });
        } catch (err) {
            // Revert on failure
            set({
                policy: { ...policy },
                isUpdating: false,
                error: err instanceof Error ? err.message : 'Failed to toggle rule',
            });
        }
    },

    deleteRule: async (policyId, ruleId) => {
        const { policy } = get();
        if (!policy) return;

        // Optimistic update
        const updatedRules = policy.rules.filter((r) => r.rule_id !== ruleId);
        set({
            policy: {
                ...policy,
                rules: updatedRules,
                rules_count: updatedRules.length,
            },
            isDirty: true,
            isUpdating: true,
        });

        try {
            await api.delete<{ success: boolean }>(
                `/policies/${policyId}/rules?rule_id=${ruleId}`,
            );
            set({ isUpdating: false });
        } catch (err) {
            // Revert on failure
            set({
                policy: { ...policy },
                isUpdating: false,
                error: err instanceof Error ? err.message : 'Failed to delete rule',
            });
        }
    },

    addPrebuiltRules: async (policyId, policyType, categories) => {
        set({ isUpdating: true, error: null });
        try {
            const data = await api.post<{ added_count: number; rules: Rule[] }>(
                `/policies/${policyId}/rules/add-prebuilt`,
                { policy_type: policyType, selected_categories: categories },
            );

            const { policy } = get();
            if (policy) {
                set({
                    policy: {
                        ...policy,
                        rules: [...policy.rules, ...data.rules],
                        rules_count: policy.rules_count + data.added_count,
                    },
                    isDirty: true,
                    isUpdating: false,
                });
            }
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to add prebuilt rules',
                isUpdating: false,
            });
        }
    },

    addPdfRules: async (policyId, file) => {
        set({ isUpdating: true, error: null });
        try {
            const formData = new FormData();
            formData.append('file', file);
            const data = await api.upload<{ added_count: number; rules: Rule[] }>(
                `/policies/${policyId}/rules/add-pdf`,
                formData,
            );

            const { policy } = get();
            if (policy) {
                set({
                    policy: {
                        ...policy,
                        rules: [...policy.rules, ...data.rules],
                        rules_count: policy.rules_count + data.added_count,
                    },
                    isDirty: true,
                    isUpdating: false,
                });
            }
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to add PDF rules',
                isUpdating: false,
            });
        }
    },

    reset: () => set(initialState),
}));
