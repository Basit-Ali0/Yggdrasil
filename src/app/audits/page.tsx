'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { AuditListResponse, AuditStatus } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { ErrorState } from '@/components/ui-custom/error-state';
import { ClipboardList, Loader2, Play, Eye } from 'lucide-react';

type Audit = AuditListResponse['audits'][number];

function sourceLabel(source?: string) {
    if (source === 'postgres') return 'Postgres';
    if (source === 's3_csv') return 'S3 CSV';
    return 'CSV upload';
}

export default function AuditsPage() {
    const router = useRouter();
    const [audits, setAudits] = useState<Audit[]>([]);
    const [status, setStatus] = useState<string>('all');
    const [source, setSource] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function loadAudits() {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get<AuditListResponse>('/audits');
            setAudits(data.audits);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audits');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAudits();
    }, []);

    const filtered = useMemo(
        () =>
            audits.filter((audit) => {
                if (status !== 'all' && audit.status !== status) return false;
                if (source !== 'all' && audit.data_source !== source) return false;
                return true;
            }),
        [audits, status, source],
    );

    if (error) return <ErrorState message={error} onRetry={loadAudits} />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Audits</h1>
                    <p className="mt-1 text-muted-foreground">Resume drafts, retry failed audits, or open completed scans.</p>
                </div>
                <Button onClick={() => router.push('/audit/new')}>New Audit</Button>
            </div>

            <div className="flex flex-wrap gap-3">
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {['draft', 'ready_to_scan', 'scan_running', 'completed', 'failed'].map((value) => (
                            <SelectItem key={value} value={value}>{value.replace(/_/g, ' ')}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All sources</SelectItem>
                        <SelectItem value="csv">CSV upload</SelectItem>
                        <SelectItem value="postgres">Postgres</SelectItem>
                        <SelectItem value="s3_csv">S3 CSV</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading audits...
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No audits found" description="Create or resume an audit to see it here." />
            ) : (
                <div className="grid gap-3">
                    {filtered.map((audit) => (
                        <Card key={audit.id}>
                            <CardHeader className="pb-2">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="text-base">{audit.name}</CardTitle>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Updated {new Date(audit.updated_at).toLocaleString()} · {sourceLabel(audit.data_source)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={audit.status === 'failed' ? 'destructive' : 'secondary'}>
                                            {audit.status.replace(/_/g, ' ')}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                audit.status === 'completed' && audit.latest_scan_id
                                                    ? router.push(`/dashboard/${audit.latest_scan_id}`)
                                                    : router.push(`/audits/${audit.id}`)
                                            }
                                        >
                                            {audit.status === 'completed' ? <Eye className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                                            {audit.status === 'completed' ? 'View Scan' : audit.status === 'failed' ? 'Retry' : 'Resume'}
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs text-muted-foreground">
                                Audit ID: <span className="font-mono-code">{audit.id.slice(0, 8)}</span>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
