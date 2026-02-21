'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { FileDropzone } from '@/components/ui-custom/file-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowRight, Database, FileText, AlertCircle } from 'lucide-react';

export default function DataUploadPage() {
    const router = useRouter();
    const params = useParams();
    const { uploadCSV, uploadData, isUploading, error, clearError } = useAuditStore();

    const handleFile = async (file: File) => {
        clearError();
        await uploadCSV(file);
        const currentError = useAuditStore.getState().error;
        if (!currentError) {
            toast.success('File uploaded', { description: `${file.name} processed successfully.` });
        }
    };

    const handleContinue = () => {
        router.push(`/audit/${params.id}/rules`);
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

            {/* Dropzone */}
            <FileDropzone
                accept=".csv"
                maxSizeMB={50}
                onFile={handleFile}
                isUploading={isUploading}
                error={error}
                label="Drop your CSV file here"
                description="Supports CSV files up to 50MB"
            />

            {/* Dataset Info */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Database className="h-4 w-4 text-primary" />
                            Recommended Dataset
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>
                            <strong>IBM AML</strong> — Synthetic financial data with ground truth
                            labels for anti-money laundering detection.
                        </CardDescription>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            Also Supported
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>
                            PaySim, Custom CSV — Any CSV with transaction data
                        </CardDescription>
                    </CardContent>
                </Card>
            </div>

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
                                        {uploadData.headers.map((header) => (
                                            <TableRow key={header}>
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
        </div>
    );
}
