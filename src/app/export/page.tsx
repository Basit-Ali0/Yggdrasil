'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useScanStore } from '@/stores/scan-store';
import { api } from '@/lib/api';
import type { CaseListResponse } from '@/lib/contracts';
import { ExportActions } from '@/components/ui-custom/export-actions';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { PageSkeleton } from '@/components/ui-custom/loading-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDown, Check, FileText } from 'lucide-react';

function sourceLabel(source?: string) {
    if (source === 'postgres') return 'Postgres';
    if (source === 's3_csv') return 'S3 CSV';
    return 'CSV upload';
}

export default function ExportPage() {
    const router = useRouter();
    const { scanHistory, fetchHistory, isLoadingHistory } = useScanStore();
    const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
    const [cases, setCases] = useState<CaseListResponse['cases']>([]);

    useEffect(() => {
        fetchHistory();
        api.get<CaseListResponse>('/cases').then((data) => setCases(data.cases)).catch(() => setCases([]));
    }, [fetchHistory]);

    useEffect(() => {
        if (scanHistory.length > 0 && !selectedScanId) setSelectedScanId(scanHistory[0].id);
    }, [scanHistory, selectedScanId]);

    if (isLoadingHistory) return <PageSkeleton />;

    const selectedScan = scanHistory.find((s) => s.id === selectedScanId);

    return (
        <div className="animate-fade-in-up space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Reports & Export</h1>
                <p className="mt-1 text-muted-foreground">Export scan reports and AML case/SAR packages.</p>
            </div>

            {scanHistory.length === 0 && cases.length === 0 ? (
                <EmptyState
                    icon={FileDown}
                    title="No reports available"
                    description="Run a compliance audit first to generate exportable reports."
                    action={{ label: 'Start New Audit', onClick: () => router.push('/audit/new') }}
                />
            ) : (
                <Tabs defaultValue="scans">
                    <TabsList>
                        <TabsTrigger value="scans">Scan Reports</TabsTrigger>
                        <TabsTrigger value="cases">Case/SAR Packages</TabsTrigger>
                    </TabsList>

                    <TabsContent value="scans" className="mt-6">
                        <div className="grid gap-6 lg:grid-cols-3">
                            <Card className="lg:col-span-1">
                                <CardHeader className="pb-3"><CardTitle className="text-base">Select Scan</CardTitle></CardHeader>
                                <CardContent className="space-y-2">
                                    {scanHistory.map((scan) => (
                                        <button
                                            key={scan.id}
                                            className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${selectedScanId === scan.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                            onClick={() => setSelectedScanId(scan.id)}
                                        >
                                            <div>
                                                <p className="font-medium">{scan.audit_name || `Scan ${scan.id.slice(0, 8)}`}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {new Date(scan.created_at).toLocaleDateString()} | {scan.violation_count ?? 0} violations | {scan.score ?? 0}% | {sourceLabel(scan.data_source)}
                                                </p>
                                            </div>
                                            {selectedScanId === scan.id && <Check className="h-4 w-4 text-primary" />}
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-2">
                                <CardHeader className="pb-3"><CardTitle className="text-base">Export Options</CardTitle></CardHeader>
                                <CardContent>
                                    {selectedScan ? (
                                        <div className="space-y-5">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <Badge variant="secondary">{selectedScan.audit_name || `Scan ${selectedScan.id.slice(0, 8)}`}</Badge>
                                                <Badge variant="outline">{selectedScan.score ?? 0}% compliance</Badge>
                                                <Badge variant="outline">{selectedScan.violation_count ?? 0} violations</Badge>
                                                <Badge variant="outline">{sourceLabel(selectedScan.data_source)}</Badge>
                                            </div>
                                            <div className="rounded-lg border p-4">
                                                <p className="mb-3 text-sm font-medium">Download this scan report:</p>
                                                <ExportActions scanId={selectedScan.id} complianceScore={selectedScan.score ?? 0} totalViolations={selectedScan.violation_count ?? 0} criticalCount={0} highCount={0} />
                                            </div>
                                            <Button asChild variant="outline" size="sm"><Link href={`/dashboard/${selectedScan.id}`}>Open Dashboard</Link></Button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Select a scan from the list to see export options.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="cases" className="mt-6">
                        {cases.length === 0 ? (
                            <EmptyState icon={FileText} title="No case packages yet" description="Run an AML scan to generate investigation cases." />
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {cases.map((c) => (
                                    <Card key={c.id}>
                                        <CardHeader className="pb-2"><CardTitle className="text-base">{c.subject_key}</CardTitle></CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="secondary">{c.status.replace(/_/g, ' ')}</Badge>
                                                <Badge variant="outline">{c.violation_count} violations</Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button asChild size="sm" variant="outline"><Link href={`/cases/${c.id}`}>Open Case</Link></Button>
                                                <Button size="sm" variant="outline" onClick={() => window.open(`/api/cases/${c.id}/export?format=json`, '_blank')}>JSON</Button>
                                                <Button size="sm" onClick={() => window.open(`/api/cases/${c.id}/export?format=pdf`, '_blank')}>PDF</Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
