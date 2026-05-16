'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type {
    AuditListResponse,
    Connector,
    ConnectorDiscoverResponse,
    ConnectorListResponse,
    ConnectorPreviewResponse,
    CreateConnectorRequest,
} from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { ErrorState } from '@/components/ui-custom/error-state';
import { Database, Loader2, PlugZap, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type ConnectorType = 'postgres' | 's3_csv';

const emptyForm = {
    name: '',
    type: 'postgres' as ConnectorType,
    host: '',
    port: '5432',
    database: '',
    ssl: true,
    user: '',
    password: '',
    region: 'us-east-1',
    bucket: '',
    prefix: '',
    key: '',
    access_key_id: '',
    secret_access_key: '',
};

export default function ConnectorsPage() {
    const [connectors, setConnectors] = useState<Connector[]>([]);
    const [audits, setAudits] = useState<AuditListResponse['audits']>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [discover, setDiscover] = useState<ConnectorDiscoverResponse | null>(null);
    const [selection, setSelection] = useState('');
    const [preview, setPreview] = useState<ConnectorPreviewResponse | null>(null);
    const [auditId, setAuditId] = useState('');

    const selected = connectors.find((connector) => connector.id === selectedId) ?? null;

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const [connectorData, auditData] = await Promise.all([
                api.get<ConnectorListResponse>('/connectors'),
                api.get<AuditListResponse>('/audits'),
            ]);
            setConnectors(connectorData.connectors);
            setAudits(auditData.audits);
            setSelectedId((current) => current ?? connectorData.connectors[0]?.id ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load connectors');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function createConnector() {
        setBusy(true);
        try {
            const body: CreateConnectorRequest =
                form.type === 'postgres'
                    ? {
                        name: form.name,
                        type: 'postgres',
                        config: { host: form.host, port: Number(form.port), database: form.database, ssl: form.ssl },
                        credentials: { user: form.user, password: form.password },
                    }
                    : {
                        name: form.name,
                        type: 's3_csv',
                        config: { region: form.region, bucket: form.bucket, prefix: form.prefix, key: form.key },
                        credentials: { access_key_id: form.access_key_id, secret_access_key: form.secret_access_key },
                    };
            const connector = await api.post<Connector>('/connectors', body);
            toast.success('Connector created');
            setForm(emptyForm);
            setSelectedId(connector.id);
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create connector');
        } finally {
            setBusy(false);
        }
    }

    async function testConnector() {
        if (!selected) return;
        setBusy(true);
        try {
            const result = await api.post<{ ok: boolean; message?: string; error?: string }>(`/connectors/${selected.id}/test`);
            toast[result.ok ? 'success' : 'error'](result.message ?? result.error ?? 'Connection test completed');
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Test failed');
        } finally {
            setBusy(false);
        }
    }

    async function discoverSource() {
        if (!selected) return;
        setBusy(true);
        setPreview(null);
        try {
            const result = await api.post<ConnectorDiscoverResponse>(`/connectors/${selected.id}/discover`);
            setDiscover(result);
            setSelection('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Discovery failed');
        } finally {
            setBusy(false);
        }
    }

    async function previewSource() {
        if (!selected || !selection) return;
        setBusy(true);
        try {
            const body = selected.type === 'postgres' ? { table: selection, limit: 20 } : { key: selection, limit: 20 };
            setPreview(await api.post<ConnectorPreviewResponse>(`/connectors/${selected.id}/preview`, body));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Preview failed');
        } finally {
            setBusy(false);
        }
    }

    async function importSource() {
        if (!selected || !selection || !auditId) return;
        setBusy(true);
        try {
            const body = selected.type === 'postgres' ? { table: selection, audit_id: auditId } : { key: selection, audit_id: auditId };
            await api.post(`/connectors/${selected.id}/import`, body);
            toast.success('Data imported into audit');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setBusy(false);
        }
    }

    async function setStatus(status: Connector['status']) {
        if (!selected) return;
        setBusy(true);
        try {
            await api.patch(`/connectors/${selected.id}`, { status });
            toast.success(`Connector ${status === 'active' ? 'enabled' : 'disabled'}`);
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Status update failed');
        } finally {
            setBusy(false);
        }
    }

    async function deleteConnector() {
        if (!selected) return;
        setBusy(true);
        try {
            await api.delete(`/connectors/${selected.id}`);
            toast.success('Connector deleted');
            setSelectedId(null);
            setDiscover(null);
            setPreview(null);
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Delete failed');
        } finally {
            setBusy(false);
        }
    }

    const options =
        selected?.type === 'postgres'
            ? discover?.schemas?.flatMap((schema) => schema.tables.map((table) => `${schema.name}.${table}`)) ?? []
            : discover?.files?.map((file) => file.key) ?? [];

    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Connectors</h1>
                <p className="mt-1 text-muted-foreground">Configure Postgres and S3 CSV sources, preview data, and import into audits.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <Card>
                    <CardHeader><CardTitle className="text-base">Create Connector</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <Select value={form.type} onValueChange={(type: ConnectorType) => setForm({ ...form, type })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="postgres">Postgres</SelectItem>
                                <SelectItem value="s3_csv">S3 CSV</SelectItem>
                            </SelectContent>
                        </Select>
                        {form.type === 'postgres' ? (
                            <>
                                <Input placeholder="Host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
                                <Input placeholder="Port" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
                                <Input placeholder="Database" value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} />
                                <Input placeholder="Username" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
                                <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                                <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                                    SSL
                                    <Switch checked={form.ssl} onCheckedChange={(ssl) => setForm({ ...form, ssl })} />
                                </label>
                            </>
                        ) : (
                            <>
                                <Input placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                                <Input placeholder="Bucket" value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} />
                                <Input placeholder="Prefix" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
                                <Input placeholder="Default key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
                                <Input placeholder="Access key ID" value={form.access_key_id} onChange={(e) => setForm({ ...form, access_key_id: e.target.value })} />
                                <Input placeholder="Secret access key" type="password" value={form.secret_access_key} onChange={(e) => setForm({ ...form, secret_access_key: e.target.value })} />
                            </>
                        )}
                        <Button className="w-full" onClick={createConnector} disabled={busy || !form.name}>
                            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                        </Button>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading connectors...</div>
                    ) : connectors.length === 0 ? (
                        <EmptyState icon={Database} title="No connectors yet" description="Create a Postgres or S3 connector to import data without CSV upload." />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {connectors.map((connector) => (
                                <button
                                    key={connector.id}
                                    className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${selectedId === connector.id ? 'border-primary bg-primary/5' : ''}`}
                                    onClick={() => {
                                        setSelectedId(connector.id);
                                        setDiscover(null);
                                        setPreview(null);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{connector.name}</span>
                                        <Badge variant="outline">{connector.status}</Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{connector.type === 'postgres' ? 'Postgres' : 'S3 CSV'}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {selected && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-base">{selected.name}</CardTitle>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={testConnector} disabled={busy}><PlugZap className="mr-2 h-4 w-4" /> Test</Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setStatus(selected.status === 'active' ? 'disabled' : 'active')}
                                            disabled={busy}
                                            aria-label={selected.status === 'active' ? 'Disable connector' : 'Enable connector'}
                                        >
                                            {selected.status === 'active' ? 'Disable' : 'Enable'}
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={deleteConnector} disabled={busy} aria-label="Delete connector"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <pre className="rounded-md border bg-muted/30 p-3 text-xs">{JSON.stringify(selected.config, null, 2)}</pre>
                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={discoverSource} disabled={busy}>Discover</Button>
                                    <Select value={selection} onValueChange={setSelection}>
                                        <SelectTrigger className="w-72"><SelectValue placeholder="Select table or CSV file" /></SelectTrigger>
                                        <SelectContent>
                                            {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" onClick={previewSource} disabled={!selection || busy}>Preview</Button>
                                </div>

                                {preview && (
                                    <div className="space-y-3">
                                        <div className="overflow-x-auto rounded-md border">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>{preview.headers.map((header, headerIndex) => <TableHead key={`${header}-${headerIndex}`}>{header}</TableHead>)}</TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {preview.rows.slice(0, 10).map((row, rowIndex) => (
                                                        <TableRow key={rowIndex}>{preview.headers.map((header, columnIndex) => <TableCell key={`${rowIndex}-${columnIndex}-${header}`}>{String(row[header] ?? '')}</TableCell>)}</TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm text-muted-foreground">{preview.total_rows?.toLocaleString() ?? preview.preview_rows} rows available</span>
                                            <Select value={auditId} onValueChange={setAuditId}>
                                                <SelectTrigger className="w-72"><SelectValue placeholder="Import into audit" /></SelectTrigger>
                                                <SelectContent>
                                                    {audits.filter((audit) => audit.status !== 'completed').map((audit) => (
                                                        <SelectItem key={audit.id} value={audit.id}>{audit.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button onClick={importSource} disabled={!auditId || busy}>Import</Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
