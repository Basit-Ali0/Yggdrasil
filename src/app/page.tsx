'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight, Zap, Target, Clock } from 'lucide-react';

export default function LandingPage() {
    const router = useRouter();
    const { enableDemoMode } = useAuthStore();

    const handleDemo = () => {
        enableDemoMode();
        router.push('/audit/new');
    };

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* Nav */}
            <header className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                        <Shield className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-semibold">Yggdrasil</span>
                </div>
                <Button variant="outline" onClick={() => router.push('/login')}>
                    Sign In
                </Button>
            </header>

            {/* Hero */}
            <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
                <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
                        <Zap className="h-3.5 w-3.5" />
                        Autonomous Compliance Engine
                    </div>

                    <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                        From Policy to Enforcement.{' '}
                        <span className="text-primary">In Minutes.</span>
                    </h1>

                    <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
                        Upload your policy PDF, connect your data, and get actionable compliance
                        violations with full explainability. No black boxes.
                    </p>

                    {/* CTAs */}
                    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <Button size="lg" className="gap-2 px-8" onClick={handleDemo}>
                            Start Demo
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() => router.push('/login')}
                        >
                            Sign In
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3 children-stagger">
                    <StatHero
                        icon={Target}
                        value="10,000+"
                        label="Rules Extracted"
                    />
                    <StatHero
                        icon={Zap}
                        value="86%"
                        label="Detection Accuracy"
                    />
                    <StatHero
                        icon={Clock}
                        value="<5s"
                        label="Scan Time"
                    />
                </div>
            </main>
        </div>
    );
}

function StatHero({
    icon: Icon,
    value,
    label,
}: {
    icon: React.ComponentType<{ className?: string }>;
    value: string;
    label: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <Icon className="h-6 w-6 text-primary" />
            <span className="font-display text-2xl font-bold">{value}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
        </div>
    );
}
