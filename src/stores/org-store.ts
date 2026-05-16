// ============================================================
// Org Store — current organization context for the authenticated user
// ============================================================

import { create } from 'zustand';
import { api } from '@/lib/api';
import type {
    CreateOrganizationRequest,
    CreateOrganizationResponse,
    OrganizationCurrentResponse,
    OrganizationListResponse,
    OrganizationSummary,
} from '@/lib/contracts';

const SELECTED_ORG_KEY = 'yggdrasil:selected-org-id';

function readSelectedOrgId(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(SELECTED_ORG_KEY);
}

function writeSelectedOrgId(orgId: string | null) {
    if (typeof window === 'undefined') return;
    if (orgId) window.localStorage.setItem(SELECTED_ORG_KEY, orgId);
    else window.localStorage.removeItem(SELECTED_ORG_KEY);
}

interface OrgState {
    organizations: OrganizationSummary[];
    currentOrg: OrganizationSummary | null;
    role: string | null;
    selectedOrgId: string | null;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    fetchOrganizations: () => Promise<void>;
    fetchCurrentOrg: () => Promise<void>;
    switchOrg: (organizationId: string) => Promise<void>;
    createOrg: (req: CreateOrganizationRequest) => Promise<OrganizationSummary>;
    clear: () => void;
}

export const useOrgStore = create<OrgState>((set, get) => ({
    organizations: [],
    currentOrg: null,
    role: null,
    selectedOrgId: null,
    isLoading: false,
    isInitialized: false,
    error: null,

    fetchOrganizations: async () => {
        const data = await api.get<OrganizationListResponse>('/organizations');
        const selectedOrgId = readSelectedOrgId();
        const selected = data.organizations.find((org) => org.id === selectedOrgId) ?? data.organizations[0] ?? null;
        if (selected?.id !== selectedOrgId) writeSelectedOrgId(selected?.id ?? null);
        set({
            organizations: data.organizations,
            currentOrg: selected,
            role: selected?.role ?? null,
            selectedOrgId: selected?.id ?? null,
        });
    },

    fetchCurrentOrg: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });
        try {
            const selectedOrgId = readSelectedOrgId();
            if (selectedOrgId && !get().currentOrg) {
                set({ selectedOrgId });
            }

            const data = await api.get<OrganizationCurrentResponse>('/organizations/current');
            const selected =
                data.organizations.find((org) => org.id === selectedOrgId)
                ?? data.organization
                ?? data.organizations[0]
                ?? null;

            writeSelectedOrgId(selected?.id ?? null);

            set({
                organizations: data.organizations,
                currentOrg: selected,
                role: selected?.role ?? data.role,
                selectedOrgId: selected?.id ?? null,
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

    switchOrg: async (organizationId) => {
        set({ isLoading: true, error: null });
        try {
            await api.post('/organizations/switch', { organization_id: organizationId });
            writeSelectedOrgId(organizationId);
            const organizations = get().organizations;
            const currentOrg = organizations.find((org) => org.id === organizationId) ?? null;
            set({
                currentOrg,
                role: currentOrg?.role ?? null,
                selectedOrgId: organizationId,
                isLoading: false,
            });
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to switch organization',
                isLoading: false,
            });
            throw err;
        }
    },

    createOrg: async (req) => {
        set({ isLoading: true, error: null });
        try {
            const data = await api.post<CreateOrganizationResponse>('/organizations', req);
            writeSelectedOrgId(data.organization.id);
            set({
                organizations: [...get().organizations.filter((org) => org.id !== data.organization.id), data.organization],
                currentOrg: data.organization,
                role: data.role,
                selectedOrgId: data.organization.id,
                isLoading: false,
                isInitialized: true,
            });
            return data.organization;
        } catch (err) {
            set({
                error: err instanceof Error ? err.message : 'Failed to create organization',
                isLoading: false,
                isInitialized: true,
            });
            throw err;
        }
    },

    clear: () =>
        {
            writeSelectedOrgId(null);
            return set({
                organizations: [],
                currentOrg: null,
                role: null,
                selectedOrgId: null,
                isLoading: false,
                isInitialized: false,
                error: null,
            });
        },
}));
