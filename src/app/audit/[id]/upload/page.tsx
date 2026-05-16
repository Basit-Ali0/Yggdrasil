'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { usePIIStore } from '@/stores/pii-store';
import { api } from '@/lib/api';
import type { Connector, ConnectorDiscoverResponse, ConnectorListResponse, ConnectorPreviewResponse, UploadDataResponse } from '@/lib/contracts';
import { FileDropzone } from '@/components/ui-custom/file-dropzone';
import { PIIAlertDialog } from '@/components/pii-alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowRight, AlertCircle, Loader2, ShieldAlert, Database } from 'lucide-react';

export default function DataUploadPage() {
    const router = useRouter();
    const params = useParams();
    const { auditId, uploadCSV, uploadData, uploadId, isUploading, error, clearError, setImportedUpload } = useAuditStore();
    const { isScanning, piiDetected, scanForPII, reset: resetPII } = usePIIStore();
    const [piiDialogOpen, setPiiDialogOpen] = useState(false);
    const [connectors, setConnectors] = useState<Connector[]>([]);
    const [selectedConnectorId, setSelectedConnectorId] = useState('');
    const [connectorSelection, setConnectorSelection] = useState('');
    const [discovered, setDiscovered] = useState<ConnectorDiscoverResponse | null>(null);
    const [preview, setPreview] = useState<ConnectorPreviewResponse | null>(null);
    const [connectorBusy, setConnectorBusy] = useState(false);

    useEffect(() => {
        api.get<ConnectorListResponse>('/connectors')
            .then((data) => setConnectors(data.connectors.filter((connector) => connector.status === 'active')))
            .catch(() => setConnectors([]));
    }, []);

    // Auto-open PII dialog when detection completes with findings
    useEffect(() => {
        if (piiDetected && !isScanning) {
            setPiiDialogOpen(true);
        }
    }, [piiDetected, isScanning]);

    const handleFile = async (file: File) => {
        clearError();
        resetPII();
        await uploadCSV(file);
        const currentState = useAuditStore.getState();
        if (!currentState.error && currentState.uploadId) {
            toast.success('File uploaded', { description: `${file.name} processed successfully.` });
            // Fire PII scan in the background (non-blocking)
            scanForPII(currentState.uploadId);
        }
    };

    const handleContinue = () => {
        router.push(`/audit/${params.id}/rules`);
    };

    const selectedConnector = connectors.find((connector) => connector.id === selectedConnectorId) ?? null;
    const connectorOptions =
        selectedConnector?.type === 'postgres'
            ? discovered?.schemas?.flatMap((schema) => schema.tables.map((table) => `${schema.name}.${table}`)) ?? []
            : discovered?.files?.map((file) => file.key) ?? [];

    const discoverConnector = async () => {
        if (!selectedConnector) return;
        setConnectorBusy(true);
        setPreview(null);
        try {
            const data = await api.post<ConnectorDiscoverResponse>(`/connectors/${selectedConnector.id}/discover`);
            setDiscovered(data);
            setConnectorSelection('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Discovery failed');
        } finally {
            setConnectorBusy(false);
        }
    };

    const previewConnector = async () => {
        if (!selectedConnector || !connectorSelection) return;
        setConnectorBusy(true);
        try {
            const body = selectedConnector.type === 'postgres'
                ? { table: connectorSelection, limit: 20 }
                : { key: connectorSelection, limit: 20 };
            setPreview(await api.post<ConnectorPreviewResponse>(`/connectors/${selectedConnector.id}/preview`, body));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Preview failed');
        } finally {
            setConnectorBusy(false);
        }
    };

    const importConnector = async () => {
        if (!selectedConnector || !connectorSelection || !auditId) return;
        setConnectorBusy(true);
        clearError();
        resetPII();
        try {
            const body = selectedConnector.type === 'postgres'
                ? { table: connectorSelection, audit_id: auditId }
                : { key: connectorSelection, audit_id: auditId };
            const data = await api.post<UploadDataResponse & { source: string; connector_id: string }>(
                `/connectors/${selectedConnector.id}/import`,
                body,
            );
            await setImportedUpload(data, { dataSource: data.source, connectorId: data.connector_id });
            toast.success('Data imported', { description: `${data.row_count.toLocaleString()} rows are ready for mapping.` });
            scanForPII(data.upload_id);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setConnectorBusy(false);
        }
    };

    return (
        <div className="animate-fade-in-up space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Upload Data</h1>
                <p className="mt-1 text-muted-foreground">
                    Upload the CSV dataset to scan against your selected policy.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <Tabs defaultValue="csv">
                <TabsList>
                    <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                    <TabsTrigger value="connector">Connector Import</TabsTrigger>
                </TabsList>
                <TabsContent value="csv" className="mt-4">
                    <FileDropzone
                        accept=".csv"
                        maxSizeMB={50}
                        onFile={handleFile}
                        isUploading={isUploading}
                        error={error}
                        label="Drop your CSV file here"
                        description="Supports CSV files up to 50MB"
                    />
                </TabsContent>
                <TabsContent value="connector" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Database className="h-4 w-4" /> Import from connector
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Select value={selectedConnectorId} onValueChange={(value) => {
                                    setSelectedConnectorId(value);
                                    setDiscovered(null);
                                    setPreview(null);
                                    setConnectorSelection('');
                                }}>
                                    <SelectTrigger className="w-72"><SelectValue placeholder="Select connector" /></SelectTrigger>
                                    <SelectContent>
                                        {connectors.map((connector) => (
                                            <SelectItem key={connector.id} value={connector.id}>
                                                {connector.name} ({connector.type === 'postgres' ? 'Postgres' : 'S3 CSV'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" onClick={discoverConnector} disabled={!selectedConnector || connectorBusy}>
                                    {connectorBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Discover
                                </Button>
                                <Select value={connectorSelection} onValueChange={setConnectorSelection}>
                                    <SelectTrigger className="w-80"><SelectValue placeholder="Select table or CSV file" /></SelectTrigger>
                                    <SelectContent>
                                        {connectorOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button variant="outline" onClick={previewConnector} disabled={!connectorSelection || connectorBusy}>Preview</Button>
                                <Button onClick={importConnector} disabled={!connectorSelection || connectorBusy}>Import</Button>
                            </div>
                            {connectors.length === 0 && (
                                <p className="text-sm text-muted-foreground">No active connectors found. Add one from the Connectors page.</p>
                            )}
                            {preview && (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>{preview.headers.map((header, headerIndex) => <TableHead key={`${header}-${headerIndex}`}>{header}</TableHead>)}</TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.rows.slice(0, 5).map((row, rowIndex) => (
                                                <TableRow key={rowIndex}>{preview.headers.map((header, columnIndex) => <TableCell key={`${rowIndex}-${columnIndex}-${header}`}>{String(row[header] ?? '')}</TableCell>)}</TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            {/* Upload Success */}
            {uploadData && (
                <div className="space-y-4 animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="text-sm">
                            {uploadData.row_count.toLocaleString()} rows detected
                        </Badge>
                        <Badge variant="secondary" className="text-sm">
                            {uploadData.headers.length} columns
                        </Badge>
                        <Badge variant="outline" className="text-sm">
                            {uploadData.detected_dataset}
                        </Badge>
                    </div>

                    {/* PII Scan Status */}
                    {isScanning && (
                        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground animate-fade-in-up">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                            <span>Checking for PII...</span>
                        </div>
                    )}

                    {piiDetected && !isScanning && (
                        <button
                            className="flex items-center gap-2 rounded-lg border border-ruby/20 bg-ruby/5 p-3 text-sm text-ruby transition-colors hover:bg-ruby/10 w-full text-left"
                            onClick={() => setPiiDialogOpen(true)}
                        >
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span>PII detected in your dataset. Click to review findings.</span>
                        </button>
                    )}

                    {/* Schema Preview */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Schema Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Column</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Sample</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {uploadData.headers.map((header, headerIndex) => (
                                            <TableRow key={`${header}-${headerIndex}`}>
                                                <TableCell className="font-mono-code text-sm">
                                                    {header}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {typeof uploadData.sample_rows[0]?.[header]}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                                    {String(uploadData.sample_rows[0]?.[header] ?? '—')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Continue */}
                    <div className="flex justify-end border-t pt-6">
                        <Button size="lg" onClick={handleContinue} className="gap-2">
                            Continue to Rules
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* PII Alert Dialog */}
            <PIIAlertDialog
                open={piiDialogOpen}
                onOpenChange={setPiiDialogOpen}
                onProceed={handleContinue}
            />
        </div>
    );
}
