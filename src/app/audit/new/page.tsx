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
import { Loader2, Shield, AlertCircle, Star, FileText, Upload, Check, Circle, RefreshCw } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { GDPR_CATEGORIES } from '@/lib/policies/gdpr';
import { SOC2_CATEGORIES } from '@/lib/policies/soc2';
import { AML_CATEGORIES } from '@/lib/policies/aml';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import type { Rule } from '@/lib/types';

const POLICY_OPTIONS = [
    {
        type: 'aml' as const,
        name: 'AML Compliance',
        description: 'Anti-Money Laundering — CTR Threshold, Structuring Detection, SAR Triggers, Velocity Monitoring',
        displayRules: '5 Categories across 11 Rules',
        recommended: true,
    },
    {
        type: 'gdpr' as const,
        name: 'GDPR',
        description: 'Data Retention, Consent, PII Protection, Encryption',
        displayRules: '14 sections across 99 articles',
        recommended: false,
    },
    {
        type: 'soc2' as const,
        name: 'SOC2',
        description: 'Access Control, Encryption, Audit Logging, Availability',
        displayRules: '5 Principles across 61 Criteria',
        recommended: false,
    },
];

type PdfStage = 'uploaded' | 'extracting' | 'extracted' | 'generating' | 'ready' | 'error';

interface ExtractedRule extends Rule {
    enabled: boolean;
}

export default function NewAuditPage() {
    const router = useRouter();
    const { createAudit, isCreating, error, clearError } = useAuditStore();
    const [name, setName] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState<'aml' | 'gdpr' | 'soc2' | 'pdf' | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfError, setPdfError] = useState<string | null>(null);

    // Category config dialog state
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // PDF extraction dialog state
    const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false);
    const [pdfStage, setPdfStage] = useState<PdfStage>('uploaded');
    const [extractedText, setExtractedText] = useState('');
    const [extractedRules, setExtractedRules] = useState<ExtractedRule[]>([]);
    const [pdfPolicyId, setPdfPolicyId] = useState<string | null>(null);
    const [pdfStageError, setPdfStageError] = useState<string | null>(null);

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

        if (selectedPolicy === 'gdpr') {
            setSelectedCategories(GDPR_CATEGORIES.map(c => c.id));
            setIsConfigDialogOpen(true);
            return;
        }

        if (selectedPolicy === 'soc2') {
            setSelectedCategories(SOC2_CATEGORIES.map(c => c.id));
            setIsConfigDialogOpen(true);
            return;
        }

        if (selectedPolicy === 'aml') {
            setSelectedCategories(AML_CATEGORIES.map(c => c.id));
            setIsConfigDialogOpen(true);
            return;
        }

        await executeAuditCreation();
    };

    const handleConfigConfirm = async () => {
        if (selectedCategories.length === 0) {
            toast.error('Select at least one category');
            return;
        }
        setIsConfigDialogOpen(false);
        await executeAuditCreation(selectedCategories);
    };

    // Progressive PDF extraction flow
    const startPdfExtraction = async () => {
        if (!pdfFile) return;

        // Reset state and open dialog
        setPdfStage('uploaded');
        setExtractedText('');
        setExtractedRules([]);
        setPdfPolicyId(null);
        setPdfStageError(null);
        setIsPdfDialogOpen(true);

        // Brief pause to show file uploaded confirmation
        await new Promise(r => setTimeout(r, 600));
        setPdfStage('extracting');

        // Stage 1: Extract text
        let pdfText = '';
        try {
            const formData = new FormData();
            formData.append('file', pdfFile);
            const textResult = await api.upload<{ text: string; char_count: number }>(
                '/policies/extract-text', formData
            );
            pdfText = textResult.text;
            setExtractedText(pdfText);
            setPdfStage('extracted');
        } catch (err) {
            setPdfStageError(err instanceof Error ? err.message : 'Failed to extract text from PDF');
            setPdfStage('error');
            return;
        }

        // Brief pause to let user see the text
        await new Promise(r => setTimeout(r, 800));
        setPdfStage('generating');

        // Stage 2: Generate rules
        try {
            const ruleResult = await api.post<{
                policy: { id: string; name: string; rules: any[]; created_at: string };
            }>('/policies/generate-rules', {
                text: pdfText,
                file_name: pdfFile.name,
            });

            setExtractedRules(
                ruleResult.policy.rules.map((r: any) => ({
                    ...r,
                    is_active: true,
                    enabled: true,
                }))
            );
            setPdfPolicyId(ruleResult.policy.id);
            setPdfStage('ready');
        } catch (err) {
            setPdfStageError(err instanceof Error ? err.message : 'Failed to generate rules');
            setPdfStage('error');
        }
    };

    const handleRetryStage = async () => {
        if (extractedText && pdfStage === 'error') {
            // Retry rule generation
            setPdfStageError(null);
            setPdfStage('generating');
            try {
                const ruleResult = await api.post<{
                    policy: { id: string; name: string; rules: any[]; created_at: string };
                }>('/policies/generate-rules', {
                    text: extractedText,
                    file_name: pdfFile?.name,
                });
                setExtractedRules(
                    ruleResult.policy.rules.map((r: any) => ({
                        ...r,
                        is_active: true,
                        enabled: true,
                    }))
                );
                setPdfPolicyId(ruleResult.policy.id);
                setPdfStage('ready');
            } catch (err) {
                setPdfStageError(err instanceof Error ? err.message : 'Failed to generate rules');
                setPdfStage('error');
            }
        } else {
            // Retry from the beginning
            await startPdfExtraction();
        }
    };

    const handlePdfConfirm = () => {
        const enabledRules = extractedRules.filter(r => r.enabled);

        useAuditStore.setState({
            policyId: pdfPolicyId,
            rules: enabledRules.map(({ enabled, ...rule }) => rule),
            auditName: name.trim(),
            policyType: 'pdf' as any,
            step: 'upload',
        });

        const auditId = crypto.randomUUID();
        useAuditStore.setState({ auditId });

        toast.success('Policy extracted', {
            description: `${enabledRules.length} rules selected from "${pdfFile?.name}"`,
        });

        setIsPdfDialogOpen(false);
        router.push(`/audit/${auditId}/upload`);
    };

    const toggleExtractedRule = (ruleId: string) => {
        setExtractedRules(prev =>
            prev.map(r => r.rule_id === ruleId ? { ...r, enabled: !r.enabled } : r)
        );
    };

    const executeAuditCreation = async (categories?: string[]) => {
        if (selectedPolicy === 'pdf' && pdfFile) {
            await startPdfExtraction();
        } else {
            // Prebuilt policy flow (AML, GDPR, SOC2)
            await createAudit({
                name: name.trim(),
                policy_type: selectedPolicy as 'aml' | 'gdpr' | 'soc2',
                selected_categories: categories
            });

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

    const isLoading = isCreating;
    const enabledCount = extractedRules.filter(r => r.enabled).length;

    const categoriesToRender =
        selectedPolicy === 'gdpr' ? GDPR_CATEGORIES :
        selectedPolicy === 'soc2' ? SOC2_CATEGORIES :
        selectedPolicy === 'aml' ? AML_CATEGORIES : [];

    // Stage indicator step status
    const getStepStatus = (step: 'upload' | 'extract' | 'rules') => {
        const stageOrder: PdfStage[] = ['uploaded', 'extracting', 'extracted', 'generating', 'ready'];
        const currentIdx = stageOrder.indexOf(pdfStage);

        if (step === 'upload') {
            return currentIdx >= 0 ? 'done' : 'pending';
        }
        if (step === 'extract') {
            if (pdfStage === 'extracting') return 'active';
            if (currentIdx >= 2) return 'done';
            return 'pending';
        }
        if (step === 'rules') {
            if (pdfStage === 'generating') return 'active';
            if (pdfStage === 'ready') return 'done';
            return 'pending';
        }
        return 'pending';
    };

    return (
        <div className="animate-fade-in-up space-y-8">
            {/* Category config dialog (AML/GDPR/SOC2) */}
            <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Configure {selectedPolicy?.toUpperCase()} Audit</DialogTitle>
                        <DialogDescription>
                            Select the specific {selectedPolicy?.toUpperCase()} issues you want to include in this audit.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-4 py-4">
                        <div className="grid gap-4">
                            {categoriesToRender.map((category) => (
                                <div key={category.id} className="flex items-center justify-between space-x-4 rounded-lg border p-3 hover:bg-muted/50">
                                    <div className="space-y-1">
                                        <Label className="text-sm font-medium leading-none">{category.name}</Label>
                                        <p className="text-xs text-muted-foreground">{category.description}</p>
                                    </div>
                                    <Switch
                                        checked={selectedCategories.includes(category.id)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedCategories([...selectedCategories, category.id]);
                                            } else {
                                                setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfigConfirm}>Continue to Data Upload</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PDF Extraction Dialog */}
            <Dialog open={isPdfDialogOpen} onOpenChange={(open) => {
                if (!open && pdfStage !== 'ready') {
                    // Allow closing only if not in the middle of extraction
                    if (pdfStage === 'uploaded' || pdfStage === 'error') {
                        setIsPdfDialogOpen(false);
                    }
                } else {
                    setIsPdfDialogOpen(open);
                }
            }}>
                <DialogContent className="sm:max-w-[90vw] sm:max-h-[85vh] h-[80vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            Extract Policy Rules
                        </DialogTitle>
                        <DialogDescription>
                            {pdfFile?.name} — {(pdfFile?.size ?? 0) > 1024 ? `${((pdfFile?.size ?? 0) / 1024).toFixed(0)} KB` : `${pdfFile?.size ?? 0} B`}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Stage Indicator */}
                    <div className="flex items-center gap-2 px-1 py-3 border-b">
                        <StepIndicator label="File Uploaded" status={getStepStatus('upload')} />
                        <div className="flex-1 h-px bg-border" />
                        <StepIndicator label="Text Extracted" status={getStepStatus('extract')} />
                        <div className="flex-1 h-px bg-border" />
                        <StepIndicator label="Rules Generated" status={getStepStatus('rules')} />
                    </div>

                    {/* Split Panel Body */}
                    <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 py-2 overflow-hidden">
                        {/* LEFT: PDF Text */}
                        <div className="flex flex-col min-h-0 h-full">
                            <h3 className="text-sm font-medium mb-2 flex items-center gap-2 shrink-0">
                                Extracted Text
                                {extractedText && (
                                    <span className="text-xs text-muted-foreground font-normal">
                                        {extractedText.length.toLocaleString()} characters
                                    </span>
                                )}
                            </h3>
                            {pdfStage === 'uploaded' || pdfStage === 'extracting' ? (
                                <div className="flex-1 flex flex-col items-center justify-center border rounded-lg bg-muted/30 gap-3">
                                    {pdfStage === 'uploaded' ? (
                                        <>
                                            <FileText className="h-16 w-16 text-primary/60" />
                                            <p className="text-sm text-muted-foreground">PDF uploaded successfully</p>
                                        </>
                                    ) : (
                                        <>
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">Extracting text from PDF...</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <ScrollArea className="flex-1 border rounded-lg">
                                    <pre className="text-xs whitespace-pre-wrap font-mono-code p-4 leading-relaxed text-muted-foreground">
                                        {extractedText}
                                    </pre>
                                </ScrollArea>
                            )}
                        </div>

                        {/* RIGHT: Rules */}
                        <div className="flex flex-col min-h-0 h-full">
                            <h3 className="text-sm font-medium mb-2 flex items-center gap-2 shrink-0">
                                Generated Rules
                                {pdfStage === 'ready' && (
                                    <span className="text-xs text-muted-foreground font-normal">
                                        {enabledCount} of {extractedRules.length} enabled
                                    </span>
                                )}
                            </h3>
                            {pdfStage === 'ready' ? (
                                <ScrollArea className="flex-1 border rounded-lg">
                                    <div className="divide-y">
                                        {extractedRules.map((rule) => (
                                            <div
                                                key={rule.rule_id}
                                                className={`flex items-start justify-between gap-3 p-3 transition-colors ${
                                                    rule.enabled ? '' : 'opacity-50'
                                                }`}
                                            >
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <p className="text-sm font-medium leading-tight">{rule.name}</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                                        {rule.description}
                                                    </p>
                                                    <div className="flex items-center gap-2 pt-0.5">
                                                        <SeverityBadge severity={rule.severity} />
                                                        <Badge variant="outline" className="text-[10px] font-mono-code">
                                                            {rule.rule_id}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={rule.enabled}
                                                    onCheckedChange={() => toggleExtractedRule(rule.rule_id)}
                                                    className="mt-1 shrink-0"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            ) : pdfStage === 'error' && extractedText ? (
                                <div className="flex-1 flex flex-col items-center justify-center border rounded-lg bg-destructive/5 gap-3 px-6">
                                    <AlertCircle className="h-8 w-8 text-destructive" />
                                    <p className="text-sm text-destructive text-center">{pdfStageError}</p>
                                    <Button size="sm" variant="outline" onClick={handleRetryStage} className="gap-2">
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Retry
                                    </Button>
                                </div>
                            ) : pdfStage === 'error' ? (
                                <div className="flex-1 flex flex-col items-center justify-center border rounded-lg bg-destructive/5 gap-3 px-6">
                                    <AlertCircle className="h-8 w-8 text-destructive" />
                                    <p className="text-sm text-destructive text-center">{pdfStageError}</p>
                                    <Button size="sm" variant="outline" onClick={handleRetryStage} className="gap-2">
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Retry from Start
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center border rounded-lg bg-muted/30 gap-3">
                                    {pdfStage === 'generating' ? (
                                        <>
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">Generating rules with AI...</p>
                                            <p className="text-xs text-muted-foreground">This may take a few seconds</p>
                                        </>
                                    ) : (
                                        <>
                                            <Circle className="h-8 w-8 text-muted-foreground/30" />
                                            <p className="text-sm text-muted-foreground">Waiting for text extraction...</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-3 border-t">
                        <Button
                            variant="outline"
                            onClick={() => setIsPdfDialogOpen(false)}
                            disabled={pdfStage === 'extracting' || pdfStage === 'generating'}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={pdfStage !== 'ready' || enabledCount === 0}
                            onClick={handlePdfConfirm}
                        >
                            Continue with {enabledCount} rule{enabledCount !== 1 ? 's' : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex items-center gap-2 mb-2 text-sm text-primary font-medium">
                <Shield className="h-4 w-4" />
                <span>Yggdrasil Compliance Engine</span>
            </div>
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
                                    {policy.displayRules}
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
                            Creating audit...
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

// Step indicator component for the PDF extraction dialog
function StepIndicator({ label, status }: { label: string; status: 'pending' | 'active' | 'done' }) {
    return (
        <div className="flex items-center gap-2">
            {status === 'done' ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
            ) : status === 'active' ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
            ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-muted-foreground/30">
                    <Circle className="h-2.5 w-2.5 text-muted-foreground/30" />
                </div>
            )}
            <span className={`text-xs font-medium ${
                status === 'done' ? 'text-primary' :
                status === 'active' ? 'text-foreground' :
                'text-muted-foreground'
            }`}>
                {label}
            </span>
        </div>
    );
}
