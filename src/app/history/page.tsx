'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useScanStore } from '@/stores/scan-store';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { PageSkeleton } from '@/components/ui-custom/loading-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { History, Plus, ArrowRight } from 'lucide-react';

export default function HistoryPage() {
    const router = useRouter();
    const { scanHistory, fetchHistory, isLoadingHistory } = useScanStore();

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    if (isLoadingHistory) {
        return <PageSkeleton />;
    }

    return (
        <div className="animate-fade-in-up space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Scan History</h1>
                    <p className="mt-1 text-muted-foreground">
                        All previous compliance scans.
                    </p>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href="/audit/new" className="gap-2">
                        <Plus className="h-3.5 w-3.5" />
                        New Audit
                    </Link>
                </Button>
            </div>

            {scanHistory.length === 0 ? (
                <EmptyState
                    icon={History}
                    title="No scan history"
                    description="Run your first compliance audit to start building history."
                    action={{
                        label: 'Start New Audit',
                        onClick: () => router.push('/audit/new'),
                    }}
                />
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                            {scanHistory.length} scan{scanHistory.length !== 1 ? 's' : ''}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Scan ID</TableHead>
                                        <TableHead>Score</TableHead>
                                        <TableHead>Violations</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {scanHistory.map((scan) => (
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
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </TableCell>
                                            <TableCell className="font-mono-code text-xs text-muted-foreground">
                                                {scan.id.slice(0, 8)}
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
                                                <Badge variant="secondary">
                                                    {scan.violation_count ?? 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        scan.status === 'completed' ? 'default' : 'outline'
                                                    }
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
            )}
        </div>
    );
}
