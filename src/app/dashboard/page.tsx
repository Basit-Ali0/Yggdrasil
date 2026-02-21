'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useScanStore } from '@/stores/scan-store';
import { useAuthStore } from '@/stores/auth-store';
import { StatCard } from '@/components/ui-custom/stat-card';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { DashboardSkeleton } from '@/components/ui-custom/loading-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    BarChart3,
    ShieldCheck,
    AlertTriangle,
    Clock,
    Plus,
    ArrowRight,
} from 'lucide-react';

export default function DashboardIndexPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { scanHistory, fetchHistory, isLoadingHistory } = useScanStore();

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    if (isLoadingHistory) {
        return <DashboardSkeleton />;
    }

    // Compute summary stats
    const totalScans = scanHistory.length;
    const avgScore =
        totalScans > 0
            ? Math.round(scanHistory.reduce((acc, s) => acc + (s.score ?? 0), 0) / totalScans)
            : 0;
    const totalViolations = scanHistory.reduce((acc, s) => acc + (s.violation_count ?? 0), 0);
    const lastScanDate =
        totalScans > 0
            ? new Date(scanHistory[0].created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })
            : '—';

    if (totalScans === 0) {
        return (
            <div className="animate-fade-in-up">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Your compliance dashboard — start your first audit to see results here.
                    </p>
                </div>
                <EmptyState
                    icon={BarChart3}
                    title="No scans yet"
                    description="Run your first compliance audit to see results and trends here."
                    action={{
                        label: 'Start New Audit',
                        onClick: () => router.push('/audit/new'),
                    }}
                />
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Compliance Overview</h1>
                    <p className="mt-1 text-muted-foreground">
                        Summary across all your scans.
                    </p>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href="/audit/new" className="gap-2">
                        <Plus className="h-3.5 w-3.5" />
                        New Audit
                    </Link>
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Scans" value={totalScans} icon={BarChart3} />
                <StatCard title="Avg Score" value={`${avgScore}%`} icon={ShieldCheck} variant="success" />
                <StatCard title="Total Violations" value={totalViolations} icon={AlertTriangle} variant="warning" />
                <StatCard title="Last Scan" value={lastScanDate} icon={Clock} />
            </div>

            {/* Recent Scans Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                        Recent Scans
                        {totalScans > 5 && (
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/history" className="gap-1 text-xs">
                                    View all
                                    <ArrowRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Violations</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {scanHistory.slice(0, 10).map((scan) => (
                                    <TableRow
                                        key={scan.id}
                                        className="cursor-pointer transition-colors hover:bg-muted/50"
                                        onClick={() => router.push(`/dashboard/${scan.id}`)}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') router.push(`/dashboard/${scan.id}`);
                                        }}
                                        role="button"
                                    >
                                        <TableCell className="text-sm">
                                            {new Date(scan.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={`font-semibold ${(scan.score ?? 0) >= 80
                                                    ? 'text-emerald-600'
                                                    : (scan.score ?? 0) >= 50
                                                        ? 'text-amber-600'
                                                        : 'text-red-600'
                                                    }`}
                                            >
                                                {scan.score ?? 0}%
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{scan.violation_count ?? 0}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={scan.status === 'completed' ? 'default' : 'outline'}
                                            >
                                                {scan.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
