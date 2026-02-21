'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, ArrowRight, Pencil, Check, Info, Loader2 } from 'lucide-react';

export default function MappingBridgePage() {
    const router = useRouter();
    const params = useParams();
    const { uploadData, confirmMapping, startScan, isMapping, error, clearError } = useAuditStore();

    const [mappingConfig, setMappingConfig] = useState<Record<string, string>>(
        uploadData?.suggested_mapping ?? {},
    );
    const [editingField, setEditingField] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Array<{ question_id: string; answer: string }>>([]);
    const [isStarting, setIsStarting] = useState(false);

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

            {/* Section A: Column Mapping */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Column Mapping</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                        disabled={isMapping || isStarting}
                    >
                        Skip All & Scan
                    </Button>
                )}
                <Button
                    size="lg"
                    className="gap-2"
                    onClick={handleApproveAndScan}
                    disabled={isMapping || isStarting}
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
