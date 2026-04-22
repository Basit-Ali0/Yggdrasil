// ============================================================
// Audit Store — Yggdrasil
// Tracks the active audit workflow (wizard screens + server persistence)
// ============================================================

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Rule } from '@/lib/types';
import type {
    CreateAuditRequest,
    CreateAuditResponse,
    UploadDataResponse,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    StartScanRequest,
    StartScanResponse,
} from '@/lib/contracts';

type AuditStep = 'new' | 'upload' | 'rules' | 'mapping' | 'scanning' | 'dashboard';

interface AuditState {
    // IDs
    auditId: string | null;
    policyId: string | null;
    uploadId: string | null;
    mappingId: string | null;
    scanId: string | null;

    // Data
    auditName: string;
    policyType: 'aml' | 'gdpr' | 'soc2' | 'pdf' | null;
    rules: Rule[];
    step: AuditStep;

    // Upload data
    uploadData: UploadDataResponse | null;

    // Loading
    isCreating: boolean;
    isUploading: boolean;
    isMapping: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    createAudit: (req: CreateAuditRequest) => Promise<void>;
    loadAudit: (auditId: string) => Promise<void>;
    uploadCSV: (file: File) => Promise<void>;
    confirmMapping: (req: Omit<ConfirmMappingRequest, 'upload_id'>) => Promise<void>;
    startScan: () => Promise<string>;
    setStep: (step: AuditStep) => void;
    setAuditName: (name: string) => void;
    setPolicyType: (type: 'aml' | 'gdpr' | 'soc2') => void;
    toggleRule: (ruleId: string) => Promise<void>;
    reset: () => void;
    clearError: () => void;
}

const initialState = {
    auditId: null as string | null,
    policyId: null as string | null,
    uploadId: null as string | null,
    mappingId: null as string | null,
    scanId: null as string | null,
    auditName: '',
    policyType: null as 'aml' | 'gdpr' | 'soc2' | 'pdf' | null,
    rules: [] as Rule[],
    step: 'new' as AuditStep,
    uploadData: null as UploadDataResponse | null,
    isCreating: false,
    isUploading: false,
    isMapping: false,
    isLoading: false,
    error: null as string | null,
};

function stepFromAuditStatus(status: string, hasUpload: boolean, hasMapping: boolean): AuditStep {
    switch (status) {
        case 'completed':
            return 'dashboard';
        case 'scan_running':
            return 'scanning';
        case 'ready_to_scan':
            return 'mapping';
        case 'failed':
            return 'mapping';
        case 'draft':
        default:
            if (hasMapping) return 'mapping';
            if (hasUpload) return 'rules';
            return 'upload';
    }
}

export const useAuditStore = create<AuditState>((set, get) => ({
    ...initialState,

    createAudit: async (req) => {
        set({ isCreating: true, error: null });
        try {
            const data = await api.post<CreateAuditResponse>('/audits', req);
            set({
                auditId: data.audit_id,
                policyId: data.policy_id,
                rules: data.rules,
                auditName: req.name,
                policyType: req.policy_type,
                step: 'upload',
                isCreating: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to create audit',
                isCreating: false,
            });
        }
    },

    loadAudit: async (auditId: string) => {
        set({ isLoading: true, error: null });
        try {
            const data = await api.get<{
                id: string;
                name: string;
                status: string;
                policy: { id: string; name: string; type: string; rules_count: number } | null;
                upload: { id: string; file_name: string; row_count: number } | null;
                mapping: { id: string; ready: boolean } | null;
                latest_scan: { id: string; status: string; score: number } | null;
                can_rescan: boolean;
            }>(`/audits/${auditId}`);

            let rules: Rule[] = [];
            if (data.policy) {
                try {
                    const policyData = await api.get<{ rules: Rule[] }>(`/policies/${data.policy.id}`);
                    rules = policyData.rules ?? [];
                } catch { /* policy rules may not be accessible */ }
            }

            const step = stepFromAuditStatus(
                data.status,
                !!data.upload,
                !!data.mapping,
            );

            set({
                auditId: data.id,
                auditName: data.name,
                policyId: data.policy?.id ?? null,
                uploadId: data.upload?.id ?? null,
                mappingId: data.mapping?.id ?? null,
                scanId: data.latest_scan?.id ?? null,
                rules,
                step,
                isLoading: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to load audit',
                isLoading: false,
            });
        }
    },

    uploadCSV: async (file) => {
        set({ isUploading: true, error: null });
        try {
            const formData = new FormData();
            formData.append('file', file);
            const data = await api.upload<UploadDataResponse>('/data/upload', formData);

            const { auditId } = get();
            if (auditId) {
                try {
                    await api.patch(`/audits/${auditId}`, { upload_id: data.upload_id });
                } catch { /* audit table may not exist yet */ }
            }

            set({
                uploadId: data.upload_id,
                uploadData: data,
                step: 'rules',
                isUploading: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to upload file',
                isUploading: false,
            });
        }
    },

    confirmMapping: async (req) => {
        const { uploadId } = get();
        if (!uploadId) return;

        set({ isMapping: true, error: null });
        try {
            const data = await api.post<ConfirmMappingResponse>('/data/mapping/confirm', {
                ...req,
                upload_id: uploadId,
            });

            const { auditId } = get();
            if (auditId) {
                try {
                    await api.patch(`/audits/${auditId}`, {
                        mapping_id: data.mapping_id,
                        status: 'ready_to_scan',
                    });
                } catch { /* audit table may not exist yet */ }
            }

            set({
                mappingId: data.mapping_id,
                isMapping: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to confirm mapping',
                isMapping: false,
            });
        }
    },

    startScan: async () => {
        const { auditId, policyId, uploadId, mappingId, auditName } = get();
        if (!auditId || !policyId || !uploadId || !mappingId) {
            throw new Error('Missing required IDs to start scan');
        }

        if (auditId) {
            try {
                await api.patch(`/audits/${auditId}`, { status: 'scan_running' });
            } catch { /* audit table may not exist yet */ }
        }

        try {
            const data = await api.post<StartScanResponse>('/scan/run', {
                audit_id: auditId,
                policy_id: policyId,
                upload_id: uploadId,
                mapping_id: mappingId,
                audit_name: auditName || undefined,
            } as StartScanRequest);

            if (auditId) {
                try {
                    await api.patch(`/audits/${auditId}`, {
                        status: 'completed',
                        latest_scan_id: data.scan_id,
                    });
                } catch { /* audit table may not exist yet */ }
            }

            set({ scanId: data.scan_id, step: 'scanning' });
            return data.scan_id;
        } catch (err) {
            if (auditId) {
                try {
                    await api.patch(`/audits/${auditId}`, {
                        status: 'failed',
                        error_message: err instanceof Error ? err.message : 'Scan failed',
                    });
                } catch { /* audit table may not exist yet */ }
            }
            throw err;
        }
    },

    setStep: (step) => set({ step }),
    setAuditName: (name) => set({ auditName: name }),
    setPolicyType: (type) => set({ policyType: type }),

    toggleRule: async (ruleId) => {
        const { policyId, rules } = get();
        const rule = rules.find((r) => r.rule_id === ruleId);
        if (!rule) return;

        const nextActive = !rule.is_active;

        if (policyId) {
            try {
                await api.patch(`/policies/${policyId}/rules`, {
                    rule_id: ruleId,
                    is_active: nextActive,
                });
            } catch (err) {
                set({
                    error:
                        err instanceof Error
                            ? err.message
                            : 'Failed to update rule on server',
                });
                return;
            }
        }

        set({
            rules: rules.map((r) =>
                r.rule_id === ruleId ? { ...r, is_active: nextActive } : r,
            ),
        });
    },

    reset: () => set(initialState),
    clearError: () => set({ error: null }),
}));
