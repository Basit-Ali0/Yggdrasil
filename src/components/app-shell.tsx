'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { DarkModeToggle } from '@/components/ui-custom/dark-mode-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface AppShellProps {
    children: React.ReactNode;
    maxWidth?: string;
}

export function AppShell({ children, maxWidth = 'max-w-5xl' }: AppShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen">
            {/* Desktop sidebar */}
            <div className="hidden lg:block">
                <AppSidebar />
            </div>

            {/* Mobile sidebar (Sheet) */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="w-64 p-0">
                    <AppSidebar />
                </SheetContent>
            </Sheet>

            {/* Main content */}
            <div className="flex flex-1 flex-col">
                {/* Top bar */}
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm lg:justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    <div className="flex items-center gap-2">
                        <DarkModeToggle />
                    </div>
                </header>

                <main className="flex-1 overflow-auto">
                    <div className={`mx-auto ${maxWidth} px-4 py-6 sm:px-6 sm:py-8`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
