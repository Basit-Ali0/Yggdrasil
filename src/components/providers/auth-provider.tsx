'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useOrgStore } from '@/stores/org-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const initialize = useAuthStore((s) => s.initialize);
    const isInitialized = useAuthStore((s) => s.isInitialized);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
    const fetchCurrentOrg = useOrgStore((s) => s.fetchCurrentOrg);
    const orgInitialized = useOrgStore((s) => s.isInitialized);

    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (isInitialized && isAuthenticated && !orgInitialized) {
            fetchCurrentOrg();
        }
    }, [isInitialized, isAuthenticated, orgInitialized, fetchCurrentOrg]);

    if (!isInitialized) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return <>{children}</>;
}
