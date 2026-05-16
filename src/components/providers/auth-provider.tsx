'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useOrgStore } from '@/stores/org-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const initialize = useAuthStore((s) => s.initialize);
    const isInitialized = useAuthStore((s) => s.isInitialized);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
    const fetchCurrentOrg = useOrgStore((s) => s.fetchCurrentOrg);
    const orgInitialized = useOrgStore((s) => s.isInitialized);
    const currentOrg = useOrgStore((s) => s.currentOrg);

    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (isInitialized && isAuthenticated && !orgInitialized) {
            fetchCurrentOrg();
        }
    }, [isInitialized, isAuthenticated, orgInitialized, fetchCurrentOrg]);

    useEffect(() => {
        const publicRoutes = ['/', '/login', '/signup'];
        const allowedWhenLoggedOut =
            publicRoutes.includes(pathname)
            || pathname.startsWith('/invite/accept');
        const allowedWithoutOrg =
            publicRoutes.includes(pathname)
            || pathname.startsWith('/onboarding/organization')
            || pathname.startsWith('/invite/accept');

        if (isInitialized && !isAuthenticated && !allowedWhenLoggedOut) {
            router.replace('/login');
            return;
        }

        if (!isInitialized || !isAuthenticated || !orgInitialized) return;
        if (!currentOrg && !allowedWithoutOrg) {
            router.replace('/onboarding/organization');
        }
    }, [isInitialized, isAuthenticated, orgInitialized, currentOrg, pathname, router]);

    if (!isInitialized || (isAuthenticated && !orgInitialized)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return <>{children}</>;
}
