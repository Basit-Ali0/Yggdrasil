'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const initialize = useAuthStore((s) => s.initialize);
    const enableDemoMode = useAuthStore((s) => s.enableDemoMode);
    const isInitialized = useAuthStore((s) => s.isInitialized);

    useEffect(() => {
        // If demo mode was previously set, restore it
        const demoSession = localStorage.getItem('demo_session');
        if (demoSession) {
            enableDemoMode();
            return;
        }

        initialize();
    }, [initialize, enableDemoMode]);

    // Show nothing while auth is loading to prevent flash
    if (!isInitialized) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return <>{children}</>;
}
