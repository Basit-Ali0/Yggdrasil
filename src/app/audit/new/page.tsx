'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Shield, AlertCircle, Star, FileText, Upload } from 'lucide-react';

const POLICY_OPTIONS = [
    {
        type: 'aml' as const,
        name: 'AML Compliance',
        description: 'Anti-Money Laundering — CTR Threshold, Structuring Detection, SAR Triggers, Velocity Monitoring',
        rules: 11,
        recommended: true,
    },
    {
        type: 'gdpr' as const,
        name: 'GDPR',
        description: 'Data Retention, Consent, PII Protection, Encryption',
        rules: 10,
        recommended: false,
    },
    {
        type: 'soc2' as const,
        name: 'SOC2',
        description: 'Access Control, Encryption, Audit Logging, Availability',
        rules: 12,
        recommended: false,
    },
];

export default function NewAuditPage() {
    const router = useRouter();
    const { createAudit, isCreating, error, clearError } = useAuditStore();
    const [name, setName] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState<'aml' | 'gdpr' | 'soc2' | 'pdf' | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isIngestingPdf, setIsIngestingPdf] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canStart = name.trim().length > 0 && selectedPolicy !== null && (selectedPolicy !== 'pdf' || pdfFile !== null);

    const handlePdfSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                setPdfError('Please select a PDF file');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setPdfError('PDF must be under 10 MB');
                return;
            }
            setPdfFile(file);
            setPdfError(null);
            setSelectedPolicy('pdf');
            clearError();
        }
    };

    const handleStart = async () => {
        if (!canStart || !selectedPolicy) return;

        if (selectedPolicy === 'pdf' && pdfFile) {
            // Custom PDF flow: upload PDF → extract rules → navigate
            setIsIngestingPdf(true);
            setPdfError(null);
            try {
                const formData = new FormData();
                formData.append('file', pdfFile);
                const data = await api.upload<{
                    policy: {
                        id: string;
                        name: string;
                        rules: any[];
                        created_at: string;
                    };
                }>('/policies/ingest', formData);

                // Store the policy in audit store and navigate
                useAuditStore.setState({
                    policyId: data.policy.id,
                    rules: data.policy.rules,
                    auditName: name.trim(),
                    policyType: 'pdf' as any,
                    step: 'upload',
                });

                // Also create the audit record
                const auditId = crypto.randomUUID();
                useAuditStore.setState({ auditId });

                toast.success('Policy extracted', {
                    description: `${data.policy.rules.length} rules extracted from "${pdfFile.name}"`,
                });
                router.push(`/audit/${auditId}/upload`);
            } catch (err) {
                setPdfError(err instanceof Error ? err.message : 'Failed to extract rules from PDF');
                toast.error('PDF extraction failed', {
                    description: err instanceof Error ? err.message : 'Check the PDF is valid and not encrypted',
                });
            } finally {
                setIsIngestingPdf(false);
            }
        } else {
            // Prebuilt policy flow (AML, GDPR, SOC2)
            await createAudit({ name: name.trim(), policy_type: selectedPolicy as 'aml' | 'gdpr' | 'soc2' });

            const currentError = useAuditStore.getState().error;
            if (!currentError) {
                const auditId = useAuditStore.getState().auditId;
                toast.success('Audit created', { description: `"${name.trim()}" is ready for data upload.` });
                router.push(`/audit/${auditId}/upload`);
            } else {
                toast.error('Failed to create audit', { description: currentError });
            }
        }
    };

    const isLoading = isCreating || isIngestingPdf;

    return (
        <div className="animate-fade-in-up space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Start New Audit</h1>
                <p className="mt-1 text-muted-foreground">
                    Name your audit and select a compliance framework or upload a custom policy PDF.
                </p>
            </div>

            {(error || pdfError) && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error || pdfError}</span>
                </div>
            )}

            {/* Audit Name */}
            <div className="max-w-md space-y-2">
                <Label htmlFor="audit-name">Audit Name</Label>
                <Input
                    id="audit-name"
                    placeholder="e.g. Q1 AML Review"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        clearError();
                    }}
                    autoFocus
                />
            </div>

            {/* Policy Selection */}
            <div className="space-y-3">
                <Label>Select Policy Framework</Label>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {POLICY_OPTIONS.map((policy) => (
                        <Card
                            key={policy.type}
                            className={`cursor-pointer transition-all
                                ${selectedPolicy === policy.type
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'hover:border-primary/50'}
                            `}
                            onClick={() => {
                                setSelectedPolicy(policy.type);
                                setPdfFile(null);
                                setPdfError(null);
                                clearError();
                            }}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <Shield className="h-5 w-5 text-primary" />
                                    </div>
                                    {policy.recommended && (
                                        <Badge variant="secondary" className="gap-1 text-xs">
                                            <Star className="h-3 w-3" />
                                            Recommended
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="mt-3 text-lg">{policy.name}</CardTitle>
                                <CardDescription className="text-xs">
                                    {policy.rules} rules
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    {policy.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Custom PDF Card */}
                    <Card
                        className={`cursor-pointer transition-all
                            ${selectedPolicy === 'pdf'
                                ? 'border-primary ring-2 ring-primary/20'
                                : 'hover:border-primary/50'}
                        `}
                        onClick={handlePdfSelect}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber/10">
                                    <FileText className="h-5 w-5 text-amber" />
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    AI-Powered
                                </Badge>
                            </div>
                            <CardTitle className="mt-3 text-lg">Custom PDF</CardTitle>
                            <CardDescription className="text-xs">
                                {pdfFile ? pdfFile.name : 'Upload your policy'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                {pdfFile
                                    ? `${(pdfFile.size / 1024).toFixed(0)} KB — Gemini will extract rules`
                                    : 'Upload any compliance PDF — Gemini extracts enforceable rules automatically'}
                            </p>
                            {!pdfFile && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                    <Upload className="h-3 w-3" />
                                    Click to select PDF (max 10 MB)
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {/* Start Button */}
            <div className="flex items-center gap-4 border-t pt-6">
                <Button
                    size="lg"
                    disabled={!canStart || isLoading}
                    onClick={handleStart}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isIngestingPdf ? 'Extracting rules from PDF...' : 'Creating audit...'}
                        </>
                    ) : (
                        'Start Audit'
                    )}
                </Button>
                {!canStart && (
                    <p className="text-sm text-muted-foreground">
                        {selectedPolicy === 'pdf' && !pdfFile
                            ? 'Select a PDF file to continue'
                            : 'Enter an audit name and select a policy to continue'}
                    </p>
                )}
            </div>
        </div>
    );
}
