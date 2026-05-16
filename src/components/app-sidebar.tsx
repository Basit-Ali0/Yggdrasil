'use client';

import { useState } from 'react';
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
    ClipboardList,
    Database,
    BriefcaseBusiness,
    Users,
    BookOpen,
    ChevronsUpDown,
    Check,
    Building2,
} from 'lucide-react';
import { useOrgStore } from '@/stores/org-store';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const navItems = [
    { href: '/audit/new', label: 'New Audit', icon: Plus },
    { href: '/audits', label: 'Audits', icon: ClipboardList },
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/connectors', label: 'Connectors', icon: Database },
    { href: '/policies', label: 'Policies', icon: BookOpen },
    { href: '/cases', label: 'Cases', icon: BriefcaseBusiness },
    { href: '/history', label: 'Scan History', icon: History },
    { href: '/export', label: 'Reports', icon: FileDown },
    { href: '/organization', label: 'Organization', icon: Users },
];

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, signOut } = useAuthStore();
    const { currentOrg, organizations, role, switchOrg } = useOrgStore();
    const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    const handleSwitchOrg = async (organizationId: string) => {
        if (organizationId === currentOrg?.id || switchingOrgId) return;
        setSwitchingOrgId(organizationId);
        try {
            await switchOrg(organizationId);
            router.push('/audit/new');
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to switch workspace');
        } finally {
            setSwitchingOrgId(null);
        }
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

            <div className="px-3 py-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-auto w-full justify-between px-3 py-2 text-left text-sidebar-foreground hover:bg-sidebar-accent/50">
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                    {currentOrg?.name ?? 'Set up workspace'}
                                </span>
                                <span className="block truncate text-xs text-sidebar-foreground/60">
                                    {currentOrg ? role ?? 'member' : 'No organization'}
                                </span>
                            </span>
                            <ChevronsUpDown className="h-4 w-4 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-60">
                        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                        {organizations.length === 0 ? (
                            <DropdownMenuItem onClick={() => router.push('/onboarding/organization')}>
                                <Building2 className="h-4 w-4" /> Set up workspace
                            </DropdownMenuItem>
                        ) : organizations.map((org) => (
                            <DropdownMenuItem
                                key={org.id}
                                onClick={() => handleSwitchOrg(org.id)}
                                disabled={switchingOrgId != null}
                            >
                                <Building2 className="h-4 w-4" />
                                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                                <span className="text-xs text-muted-foreground">{org.role}</span>
                                {org.id === currentOrg?.id && <Check className="h-4 w-4" />}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/organization/new')}>
                            <Plus className="h-4 w-4" /> Create organization
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/organization')}>
                            <Users className="h-4 w-4" /> Organization settings
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

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
                        <p className="truncate text-xs text-sidebar-foreground/60">
                            {currentOrg ? `${currentOrg.name} · ${role ?? 'member'}` : 'No workspace'}
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
