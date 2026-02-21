// ============================================================
// Audit Store — Yggdrasil
// Tracks the active wizard flow (screens 2-6)
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
    policyType: 'aml' | 'gdpr' | 'soc2' | null;
    rules: Rule[];
    step: AuditStep;

    // Upload data
    uploadData: UploadDataResponse | null;

    // Loading
    isCreating: boolean;
    isUploading: boolean;
    isMapping: boolean;
    error: string | null;

    // Actions
    createAudit: (req: CreateAuditRequest) => Promise<void>;
    uploadCSV: (file: File) => Promise<void>;
    confirmMapping: (req: Omit<ConfirmMappingRequest, 'upload_id'>) => Promise<void>;
    startScan: () => Promise<string>;
    setStep: (step: AuditStep) => void;
    setAuditName: (name: string) => void;
    setPolicyType: (type: 'aml' | 'gdpr' | 'soc2') => void;
    toggleRule: (ruleId: string) => void;
    reset: () => void;
    clearError: () => void;
}

const initialState = {
    auditId: null,
    policyId: null,
    uploadId: null,
    mappingId: null,
    scanId: null,
    auditName: '',
    policyType: null as 'aml' | 'gdpr' | 'soc2' | null,
    rules: [] as Rule[],
    step: 'new' as AuditStep,
    uploadData: null as UploadDataResponse | null,
    isCreating: false,
    isUploading: false,
    isMapping: false,
    error: null as string | null,
};

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

    uploadCSV: async (file) => {
        set({ isUploading: true, error: null });
        try {
            const formData = new FormData();
            formData.append('file', file);
            const data = await api.upload<UploadDataResponse>('/data/upload', formData);
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

        const data = await api.post<StartScanResponse>('/scan/run', {
            audit_id: auditId,
            policy_id: policyId,
            upload_id: uploadId,
            mapping_id: mappingId,
            audit_name: auditName || undefined,
        } as StartScanRequest);

        set({ scanId: data.scan_id, step: 'scanning' });
        return data.scan_id;
    },

    setStep: (step) => set({ step }),
    setAuditName: (name) => set({ auditName: name }),
    setPolicyType: (type) => set({ policyType: type }),

    toggleRule: (ruleId) => {
        const rules = get().rules.map((r) =>
            r.rule_id === ruleId ? { ...r, is_active: !r.is_active } : r,
        );
        set({ rules });
    },

    reset: () => set(initialState),
    clearError: () => set({ error: null }),
}));
