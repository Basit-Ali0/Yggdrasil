// ============================================================
// Violation Store — Yggdrasil
// Cases, violation details, review actions + optimistic updates
// ============================================================

import { create } from 'zustand';
import { api } from '@/lib/api';
import type {
    ViolationCase,
    ViolationCasesResponse,
    ViolationDetailResponse,
    ReviewViolationRequest,
    ReviewViolationResponse,
    ComplianceScoreResponse,
} from '@/lib/contracts';

interface ViolationState {
    cases: ViolationCase[];
    totalCases: number;
    totalViolations: number;
    complianceScore: number;
    activeViolation: ViolationDetailResponse | null;
    scoreDetails: ComplianceScoreResponse | null;
    isLoadingCases: boolean;
    isLoadingDetail: boolean;
    isReviewing: boolean;
    error: string | null;

    // Actions
    fetchCases: (scanId: string) => Promise<void>;
    fetchViolation: (violationId: string) => Promise<void>;
    reviewViolation: (violationId: string, req: ReviewViolationRequest) => Promise<void>;
    fetchScore: (scanId?: string) => Promise<void>;
    clearActiveViolation: () => void;
    clearError: () => void;
    reset: () => void;
}

export const useViolationStore = create<ViolationState>((set, get) => ({
    cases: [],
    totalCases: 0,
    totalViolations: 0,
    complianceScore: 0,
    activeViolation: null,
    scoreDetails: null,
    isLoadingCases: false,
    isLoadingDetail: false,
    isReviewing: false,
    error: null,

    fetchCases: async (scanId) => {
        set({ isLoadingCases: true, error: null });
        try {
            const data = await api.get<ViolationCasesResponse>(
                `/violations/cases?scan_id=${scanId}`,
            );
            set({
                cases: data.cases,
                totalCases: data.total_cases,
                totalViolations: data.total_violations,
                complianceScore: data.compliance_score,
                isLoadingCases: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load cases',
                isLoadingCases: false,
            });
        }
    },

    fetchViolation: async (violationId) => {
        set({ isLoadingDetail: true, error: null });
        try {
            const data = await api.get<ViolationDetailResponse>(`/violations/${violationId}`);
            set({ activeViolation: data, isLoadingDetail: false });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load violation',
                isLoadingDetail: false,
            });
        }
    },

    reviewViolation: async (violationId, req) => {
        set({ isReviewing: true, error: null });

        // Optimistic update
        const prevViolation = get().activeViolation;
        if (prevViolation) {
            set({
                activeViolation: {
                    ...prevViolation,
                    status: req.status === 'approved' ? 'approved' : 'false_positive',
                    review_note: req.review_note ?? null,
                },
            });
        }

        try {
            const data = await api.patch<ReviewViolationResponse>(
                `/violations/${violationId}`,
                req,
            );
            set({
                complianceScore: data.updated_score,
                isReviewing: false,
            });
        } catch (err) {
            // Rollback optimistic update
            if (prevViolation) {
                set({ activeViolation: prevViolation });
            }
            set({
                error: err instanceof Error ? err.message : 'Failed to review violation',
                isReviewing: false,
            });
        }
    },

    fetchScore: async (scanId) => {
        try {
            const path = scanId
                ? `/compliance/score?scan_id=${scanId}`
                : '/compliance/score';
            const data = await api.get<ComplianceScoreResponse>(path);
            set({
                scoreDetails: data,
                complianceScore: data.score,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load score',
            });
        }
    },

    clearActiveViolation: () => set({ activeViolation: null }),
    clearError: () => set({ error: null }),
    reset: () =>
        set({
            cases: [],
            totalCases: 0,
            totalViolations: 0,
            complianceScore: 0,
            activeViolation: null,
            scoreDetails: null,
            isLoadingCases: false,
            isLoadingDetail: false,
            isReviewing: false,
            error: null,
        }),
}));
