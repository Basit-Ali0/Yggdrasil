'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Shield,
    ArrowRight,
    Zap,
    Target,
    FileText,
    Database,
    CheckCircle,
    BookOpen,
    TrendingUp,
    DollarSign,
} from 'lucide-react';

export default function LandingPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    const handleGetStarted = () => {
        router.push(isAuthenticated() ? '/audit/new' : '/login');
    };

    const handleSignOut = async () => {
        const { signOut } = useAuthStore.getState();
        await signOut();
        router.refresh();
    };

    const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* ── Header ─────────────────────────────────────────── */}
            <header className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                        <Shield className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-semibold">Yggdrasil</span>
                </div>
                {isAuthenticated() ? (
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">Hi, {userName}</span>
                        <Button variant="outline" size="sm" onClick={handleSignOut}>
                            Sign Out
                        </Button>
                    </div>
                ) : (
                    <Button variant="outline" onClick={() => router.push('/login')}>
                        Sign In
                    </Button>
                )}
            </header>

            {/* ── Hero ───────────────────────────────────────────── */}
            <section className="flex flex-col items-center px-4 py-20">
                <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
                        <Zap className="h-3.5 w-3.5" />
                        Autonomous Compliance Engine
                    </div>

                    <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                        From Policy PDF to Compliance Report.{' '}
                        <span className="text-primary">In Minutes.</span>
                    </h1>

                    <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                        Upload your regulatory policy, connect your dataset, and get
                        explainable compliance violations — with every finding traced
                        back to the exact policy clause. No auditors. No black boxes.
                    </p>

                    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <Button size="lg" className="gap-2 px-8" onClick={handleGetStarted}>
                            Start an Audit
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* ── How It Works ───────────────────────────────────── */}
            <section className="bg-muted/30 px-4 py-20">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-display text-center text-3xl font-bold tracking-tight">
                        How It Works
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
                        Three steps. No consultants, no manual rule-writing, no waiting.
                    </p>

                    <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 children-stagger">
                        <StepCard
                            step={1}
                            icon={FileText}
                            title="Upload Policy"
                            description="Upload any regulatory PDF — AML, GDPR, SOC2, or your own custom policy. AI extracts enforceable rules in seconds."
                        />
                        <StepCard
                            step={2}
                            icon={Database}
                            title="Connect Data"
                            description="Upload your CSV dataset. AI maps your columns automatically, detects the schema, and flags any PII exposure."
                        />
                        <StepCard
                            step={3}
                            icon={CheckCircle}
                            title="Get Results"
                            description="Violations ranked by severity with AI explanations, policy excerpts, evidence grids, and confidence scores."
                        />
                    </div>
                </div>
            </section>

            {/* ── Why Yggdrasil ──────────────────────────────────── */}
            <section className="px-4 py-20">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-display text-center text-3xl font-bold tracking-tight">
                        Why Yggdrasil
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
                        Designed for trust, precision, and continuous improvement.
                    </p>

                    <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 children-stagger">
                        <ValueCard
                            icon={BookOpen}
                            title="Every Violation is Explainable"
                            description="Each finding includes the exact policy clause it violates, the evidence from your data, and an AI-generated explanation. You can trace every alert back to its source — no trust required."
                        />
                        <ValueCard
                            icon={Target}
                            title="Built for Low False Positives"
                            description="Rules are scored using a Signal Specificity Framework. Single-threshold rules are rejected — every rule must combine multiple signals (behavioral, temporal, relational) to reach a precision threshold before it can fire."
                        />
                        <ValueCard
                            icon={TrendingUp}
                            title="The System Gets Smarter"
                            description="When you approve or dismiss a violation, that feedback flows into a Bayesian precision model. Rules that produce false positives lose confidence. Rules that catch real issues gain weight. Your reviews make the next scan better."
                        />
                        <ValueCard
                            icon={DollarSign}
                            title="Skip the Auditor"
                            description="Enterprise compliance audits cost $50K–$200K and take weeks. Yggdrasil gives small and mid-size teams the same coverage in minutes, at a fraction of the cost. Policy-to-enforcement, self-serve."
                        />
                    </div>
                </div>
            </section>

            {/* ── Stats ──────────────────────────────────────────── */}
            <section className="bg-muted/30 px-4 py-16">
                <div className="mx-auto max-w-3xl">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 children-stagger">
                        <StatHero
                            icon={Shield}
                            value="3 Frameworks"
                            label="AML, GDPR, SOC2 + custom PDF"
                        />
                        <StatHero
                            icon={Zap}
                            value="< 5 seconds"
                            label="50K row scan time"
                        />
                        <StatHero
                            icon={TrendingUp}
                            value="Bayesian Feedback"
                            label="Self-improving precision"
                        />
                    </div>
                </div>
            </section>

            {/* ── Footer CTA ─────────────────────────────────────── */}
            <section className="px-4 py-20">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="font-display text-3xl font-bold tracking-tight">
                        Ready to run your first audit?
                    </h2>
                    <div className="mt-8">
                        <Button size="lg" className="gap-2 px-8" onClick={handleGetStarted}>
                            Get Started
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                        No credit card required. Upload a policy and scan in under 5 minutes.
                    </p>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────── */}
            <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
                Yggdrasil — Autonomous Compliance Engine
            </footer>
        </div>
    );
}

/* ── Helper Components ──────────────────────────────────────────── */

function StepCard({
    step,
    icon: Icon,
    title,
    description,
}: {
    step: number;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <Badge variant="secondary" className="text-xs font-mono">
                    {step}
                </Badge>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </CardContent>
        </Card>
    );
}

function ValueCard({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <Card>
            <CardContent className="flex gap-4 p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-display text-base font-semibold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                </div>
            </CardContent>
        </Card>
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
