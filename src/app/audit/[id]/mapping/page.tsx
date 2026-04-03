'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { api } from '@/lib/api';
import type { MappingReadinessResponse } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    AlertCircle,
    ArrowRight,
    Pencil,
    Check,
    Info,
    Loader2,
    ChevronDown,
    ShieldAlert,
} from 'lucide-react';

export default function MappingBridgePage() {
    const router = useRouter();
    const params = useParams();
    const {
        uploadData,
        confirmMapping,
        startScan,
        isMapping,
        error,
        clearError,
        policyId,
        uploadId,
    } = useAuditStore();

    const [mappingConfig, setMappingConfig] = useState<Record<string, string>>(
        uploadData?.suggested_mapping ?? {},
    );
    const [editingField, setEditingField] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Array<{ question_id: string; answer: string }>>([]);
    const [isStarting, setIsStarting] = useState(false);
    const [readiness, setReadiness] = useState<MappingReadinessResponse | null>(null);
    const [readinessLoading, setReadinessLoading] = useState(false);
    const [readinessError, setReadinessError] = useState<string | null>(null);

    useEffect(() => {
        if (!policyId || !uploadId || !uploadData) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            setReadinessLoading(true);
            try {
                const data = await api.post<MappingReadinessResponse>('/data/mapping/readiness', {
                    policy_id: policyId,
                    upload_id: uploadId,
                    mapping_config: mappingConfig,
                    mapping_confidence: uploadData.mapping_confidence,
                });
                if (!cancelled) {
                    setReadiness(data);
                    setReadinessError(null);
                }
            } catch (e) {
                if (!cancelled) {
                    setReadiness(null);
                    setReadinessError(
                        e instanceof Error ? e.message : 'Could not evaluate mapping readiness',
                    );
                }
            } finally {
                if (!cancelled) setReadinessLoading(false);
            }
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [policyId, uploadId, mappingConfig, uploadData]);

    const scanBlocked = readiness?.state === 'blocked';

    if (!uploadData) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-muted-foreground">No upload data found. Please upload a CSV first.</p>
            </div>
        );
    }

    const handleMapping = (ruleField: string, csvColumn: string) => {
        setMappingConfig((prev) => ({ ...prev, [ruleField]: csvColumn }));
        setEditingField(null);
    };

    const handleAnswer = (questionId: string, answer: string) => {
        setAnswers((prev) => {
            const existing = prev.findIndex((a) => a.question_id === questionId);
            if (existing >= 0) {
                const next = [...prev];
                next[existing] = { question_id: questionId, answer };
                return next;
            }
            return [...prev, { question_id: questionId, answer }];
        });
    };

    const handleApproveAndScan = async () => {
        setIsStarting(true);
        clearError();
        try {
            await confirmMapping({
                mapping_config: mappingConfig,
                temporal_scale: uploadData.temporal_scale,
                clarification_answers: answers,
            });

            const scanId = await startScan();
            router.push(`/audit/${params.id}/scanning?scan=${scanId}`);
        } catch (err) {
            setIsStarting(false);
            useAuditStore.setState({ error: err instanceof Error ? err.message : String(err) });
        }
    };

    const handleSkipAndScan = async () => {
        setIsStarting(true);
        clearError();
        try {
            await confirmMapping({
                mapping_config: mappingConfig,
                temporal_scale: uploadData.temporal_scale,
                clarification_answers: [],
            });

            const scanId = await startScan();
            router.push(`/audit/${params.id}/scanning?scan=${scanId}`);
        } catch (err) {
            setIsStarting(false);
            useAuditStore.setState({ error: err instanceof Error ? err.message : String(err) });
        }
    };

    const getConfidence = (field: string): number => {
        // Use real confidence values from the backend
        // Known datasets (PAYSIM, IBM_AML) = 100%, GENERIC = Gemini-reported
        const backendConfidence = (uploadData as any).mapping_confidence;
        if (backendConfidence && backendConfidence[field] != null) {
            return backendConfidence[field];
        }
        // Fallback for fields not in the mapping (e.g., user-added fields)
        return 0;
    };

    return (
        <div className="animate-fade-in-up space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Column Mapping</h1>
                <p className="mt-1 text-muted-foreground">
                    Review AI-suggested mappings before scanning. You can override any mapping.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Dataset Banner */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm">
                    Detected: <strong>{uploadData.detected_dataset}</strong> Format ·
                    Temporal Scale: <strong>{uploadData.temporal_scale}x</strong>
                    {uploadData.temporal_scale === 24 ? ' (daily → hourly)' : ''}
                </span>
            </div>

            {/* Pre-scan readiness (server + active policy rules) */}
            <Card
                className={
                    readiness?.state === 'blocked'
                        ? 'border-destructive/40 bg-destructive/5'
                        : readiness?.state === 'warning'
                          ? 'border-amber/40 bg-amber/5'
                          : ''
                }
            >
                <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">Scan readiness</CardTitle>
                        {readinessLoading && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Checking…
                            </span>
                        )}
                        {!readinessLoading && readiness && (
                            <Badge
                                variant={
                                    readiness.state === 'ready'
                                        ? 'default'
                                        : readiness.state === 'warning'
                                          ? 'secondary'
                                          : 'destructive'
                                }
                                className="font-normal"
                            >
                                {readiness.state === 'ready' && 'Ready to scan'}
                                {readiness.state === 'warning' && 'Ready with warnings'}
                                {readiness.state === 'blocked' && 'Blocked'}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {readinessError && (
                        <p className="text-destructive">{readinessError}</p>
                    )}
                    {readiness && (
                        <>
                            {readiness.missing_required.length > 0 && (
                                <div className="flex gap-2 rounded-md border border-destructive/30 bg-background/80 p-3">
                                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                    <div>
                                        <p className="font-medium text-destructive">
                                            Missing required mappings
                                        </p>
                                        <ul className="mt-1 list-inside list-disc text-muted-foreground">
                                            {readiness.missing_required.map((f) => (
                                                <li key={f}>{f}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                            {readiness.invalid_columns.length > 0 && (
                                <div className="rounded-md border border-destructive/30 bg-background/80 p-3">
                                    <p className="font-medium text-destructive">
                                        Mapped columns not in this file
                                    </p>
                                    <ul className="mt-1 list-inside list-disc text-muted-foreground">
                                        {readiness.invalid_columns.map((line) => (
                                            <li key={line}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {readiness.warnings.length > 0 && (
                                <div className="rounded-md border border-amber/30 bg-background/80 p-3">
                                    <p className="font-medium text-amber">Warnings</p>
                                    <ul className="mt-1 list-inside list-disc text-muted-foreground">
                                        {readiness.warnings.map((w, i) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {readiness.required_fields.length > 0 && (
                                <p className="text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                        Required for current rules:{' '}
                                    </span>
                                    {readiness.required_fields.join(', ')}
                                </p>
                            )}
                            <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                                    <ChevronDown className="h-3 w-3" />
                                    Rule → field dependencies
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 space-y-2">
                                    {readiness.rule_dependencies
                                        .filter((r) => r.is_active)
                                        .map((r) => (
                                            <div
                                                key={r.rule_id}
                                                className="rounded border bg-muted/30 px-2 py-1.5 font-mono-code text-xs"
                                            >
                                                <span className="text-muted-foreground">
                                                    {r.rule_id}
                                                </span>
                                                <span className="mx-2 text-border">·</span>
                                                {r.required_fields.join(', ')}
                                            </div>
                                        ))}
                                </CollapsibleContent>
                            </Collapsible>
                            {readiness.sample_normalized_rows.length > 0 && (
                                <div>
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Sample normalized rows
                                    </p>
                                    <ScrollArea className="h-[140px] w-full rounded-md border">
                                        <pre className="p-3 font-mono-code text-[11px] leading-relaxed">
                                            {JSON.stringify(
                                                readiness.sample_normalized_rows,
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    </ScrollArea>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Section A: Column Mapping */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Column Mapping</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Column header labels */}
                    <div className="flex items-center gap-4 px-3 pb-1">
                        <div className="min-w-[120px]">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Policy Field</span>
                        </div>
                        <span className="invisible">→</span>
                        <div className="min-w-[120px]">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CSV Column</span>
                        </div>
                        <div className="flex-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confidence</span>
                        </div>
                    </div>
                    {Object.entries(mappingConfig).map(([ruleField, csvColumn]) => {
                        const confidence = getConfidence(ruleField);
                        const isLowConfidence = confidence < 90;

                        return (
                            <div
                                key={ruleField}
                                className={`flex items-center gap-4 rounded-lg border p-3 ${isLowConfidence ? 'border-amber/30 bg-amber/5' : ''
                                    }`}
                            >
                                <div className="min-w-[120px]">
                                    <span className="text-sm font-medium">{ruleField}</span>
                                </div>
                                <span className="text-muted-foreground">→</span>
                                <div className="min-w-[120px]">
                                    {editingField === ruleField ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                defaultValue={csvColumn}
                                                className="h-8 text-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleMapping(ruleField, e.currentTarget.value);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setEditingField(null)}
                                            >
                                                <Check className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="font-mono-code text-sm">{csvColumn}</span>
                                    )}
                                </div>
                                <div className="flex flex-1 items-center gap-2">
                                    <Progress
                                        value={confidence}
                                        className="h-2 flex-1"
                                    />
                                    <span className={`text-xs font-medium ${confidence >= 90 ? 'text-emerald' : 'text-amber'
                                        }`}>
                                        {confidence}%
                                    </span>
                                </div>
                                {editingField !== ruleField && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingField(ruleField)}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Section B: Clarification Questions */}
            {uploadData.clarification_questions.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Clarification Questions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {uploadData.clarification_questions.map((q) => {
                            const currentAnswer = answers.find(
                                (a) => a.question_id === q.question_id,
                            );
                            return (
                                <div
                                    key={q.question_id}
                                    className="rounded-lg border p-4"
                                >
                                    <p className="text-sm font-medium">{q.question}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {q.options.map((option) => (
                                            <Badge
                                                key={option}
                                                variant={
                                                    currentAnswer?.answer === option
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                className="cursor-pointer"
                                                onClick={() => handleAnswer(q.question_id, option)}
                                            >
                                                {option}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {uploadData.clarification_questions.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border bg-emerald/5 border-emerald/20 px-4 py-3 text-sm text-emerald">
                    <Check className="h-4 w-4" />
                    No clarifications needed — ready to scan.
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t pt-6">
                {uploadData.clarification_questions.length > 0 && (
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={handleSkipAndScan}
                        disabled={isMapping || isStarting || scanBlocked || readinessLoading}
                    >
                        Skip All & Scan
                    </Button>
                )}
                <Button
                    size="lg"
                    className="gap-2"
                    onClick={handleApproveAndScan}
                    disabled={isMapping || isStarting || scanBlocked || readinessLoading}
                >
                    {isMapping || isStarting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting scan...
                        </>
                    ) : (
                        <>
                            Approve & Scan
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
