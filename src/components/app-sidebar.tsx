'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Shield,
    BarChart3,
    History,
    FileDown,
    LogOut,
    Plus,
    User,
} from 'lucide-react';

const navItems = [
    { href: '/audit/new', label: 'New Audit', icon: Plus },
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/history', label: 'Scan History', icon: History },
    { href: '/export', label: 'Reports', icon: FileDown },
];

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut } = useAuthStore();

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    return (
        <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 px-5 py-5 transition-opacity hover:opacity-80">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
                    <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold text-sidebar-foreground">Yggdrasil</h1>
                    <p className="text-xs text-sidebar-foreground/60">Compliance Engine</p>
                </div>
            </Link>

            <Separator className="bg-sidebar-border" />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto space-y-1 px-3 py-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* User section */}
            <div className="border-t border-sidebar-border p-4">
                <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent">
                        <User className="h-4 w-4 text-sidebar-accent-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                            {user?.email ?? 'User'}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    onClick={handleSignOut}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </aside>
    );
}
