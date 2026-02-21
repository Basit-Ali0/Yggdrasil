'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { AppShell } from '@/components/app-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
    const isInitialized = useAuthStore((s) => s.isInitialized);

    useEffect(() => {
        if (isInitialized && !isAuthenticated) {
            router.push('/login');
        }
    }, [isInitialized, isAuthenticated, router]);

    if (!isInitialized || !isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return <AppShell maxWidth="max-w-7xl">{children}</AppShell>;
}
