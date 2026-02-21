'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScanStore } from '@/stores/scan-store';
import { ExportActions } from '@/components/ui-custom/export-actions';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { PageSkeleton } from '@/components/ui-custom/loading-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileDown, Plus, Check } from 'lucide-react';

export default function ExportPage() {
    const router = useRouter();
    const { scanHistory, fetchHistory, isLoadingHistory } = useScanStore();
    const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useEffect(() => {
        // Auto-select latest scan
        if (scanHistory.length > 0 && !selectedScanId) {
            setSelectedScanId(scanHistory[0].id);
        }
    }, [scanHistory, selectedScanId]);

    if (isLoadingHistory) {
        return <PageSkeleton />;
    }

    const selectedScan = scanHistory.find((s) => s.id === selectedScanId);

    return (
        <div className="animate-fade-in-up space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Reports & Export</h1>
                <p className="mt-1 text-muted-foreground">
                    Select a scan to export or print the compliance report.
                </p>
            </div>

            {scanHistory.length === 0 ? (
                <EmptyState
                    icon={FileDown}
                    title="No reports available"
                    description="Run a compliance audit first to generate exportable reports."
                    action={{
                        label: 'Start New Audit',
                        onClick: () => router.push('/audit/new'),
                    }}
                />
            ) : (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Scan Selector */}
                    <Card className="lg:col-span-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Select Scan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {scanHistory.map((scan) => (
                                <button
                                    key={scan.id}
                                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${selectedScanId === scan.id
                                        ? 'border-primary bg-primary/5'
                                        : 'hover:border-primary/50'
                                        }`}
                                    onClick={() => setSelectedScanId(scan.id)}
                                >
                                    <div>
                                        <p className="font-medium">
                                            {new Date(scan.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {scan.violation_count ?? 0} violations · {scan.score ?? 0}%
                                        </p>
                                    </div>
                                    {selectedScanId === scan.id && (
                                        <Check className="h-4 w-4 text-primary" />
                                    )}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Export Options */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Export Options</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedScan ? (
                                <div className="space-y-6">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge variant="secondary">
                                            Scan {selectedScan.id.slice(0, 8)}
                                        </Badge>
                                        <Badge variant="outline">
                                            {selectedScan.score ?? 0}% compliance
                                        </Badge>
                                        <Badge variant="outline">
                                            {selectedScan.violation_count ?? 0} violations
                                        </Badge>
                                    </div>

                                    <div className="rounded-lg border p-4">
                                        <p className="mb-3 text-sm font-medium">
                                            Download or share this scan's report:
                                        </p>
                                        <ExportActions
                                            scanId={selectedScan.id}
                                            complianceScore={selectedScan.score ?? 0}
                                            totalViolations={selectedScan.violation_count ?? 0}
                                            criticalCount={0}
                                            highCount={0}
                                        />
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        Use "Print as PDF" for a branded Yggdrasil audit trail document.
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Select a scan from the list to see export options.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
