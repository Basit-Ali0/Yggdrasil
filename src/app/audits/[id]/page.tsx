'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { AuditDetailResponse } from '@/lib/contracts';
import { useAuditStore } from '@/stores/audit-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui-custom/error-state';
import { Loader2, ArrowRight, RotateCcw } from 'lucide-react';

function sourceLabel(source?: string) {
    if (source === 'postgres') return 'Postgres';
    if (source === 's3_csv') return 'S3 CSV';
    return 'CSV upload';
}

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { loadAudit, startScan } = useAuditStore();
    const [audit, setAudit] = useState<AuditDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get<AuditDetailResponse>(`/audits/${id}`);
            setAudit(data);
            await loadAudit(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audit');
        } finally {
            setLoading(false);
        }
    }, [id, loadAudit]);

    useEffect(() => {
        load();
    }, [load]);

    async function continueAudit() {
        if (!audit) return;
        if (audit.status === 'completed' && audit.latest_scan?.id) {
            router.push(`/dashboard/${audit.latest_scan.id}`);
            return;
        }
        if (!audit.upload) {
            router.push(`/audit/${audit.id}/upload`);
            return;
        }
        if (!audit.mapping) {
            router.push(`/audit/${audit.id}/rules`);
            return;
        }
        setStarting(true);
        try {
            const scanId = await startScan();
            router.push(`/audit/${audit.id}/scanning?scan=${scanId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start scan');
            setStarting(false);
        }
    }

    if (error) return <ErrorState message={error} onRetry={load} />;
    if (loading || !audit) {
        return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading audit...</div>;
    }

    const nextLabel =
        audit.status === 'completed' ? 'View Dashboard' :
        !audit.upload ? 'Continue Upload' :
        !audit.mapping ? 'Continue Mapping' :
        audit.status === 'failed' ? 'Retry Scan' : 'Start Scan';

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{audit.name}</h1>
                    <p className="mt-1 text-muted-foreground">Audit workspace and resume point.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={audit.status === 'failed' ? 'destructive' : 'secondary'}>{audit.status.replace(/_/g, ' ')}</Badge>
                    <Button onClick={continueAudit} disabled={starting}>
                        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : audit.status === 'failed' ? <RotateCcw className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                        {nextLabel}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Policy</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                        {audit.policy ? (
                            <div>
                                <p className="font-medium">{audit.policy.name}</p>
                                <p className="text-muted-foreground">{audit.policy.rules_count} rules</p>
                            </div>
                        ) : <p className="text-muted-foreground">No policy selected</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Data Source</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                        <p className="font-medium">{sourceLabel(audit.data_source)}</p>
                        {audit.upload ? (
                            <p className="text-muted-foreground">{audit.upload.file_name} · {audit.upload.row_count.toLocaleString()} rows</p>
                        ) : <p className="text-muted-foreground">No data imported yet</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Mapping</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                        {audit.mapping ? <p className="text-emerald">Ready</p> : <p className="text-muted-foreground">Not confirmed</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Latest Scan</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                        {audit.latest_scan ? (
                            <div>
                                <p className="font-medium">{audit.latest_scan.score ?? 0}% score · {audit.latest_scan.violation_count} violations</p>
                                <p className="text-muted-foreground">{audit.latest_scan.status}</p>
                            </div>
                        ) : <p className="text-muted-foreground">No scan yet</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
