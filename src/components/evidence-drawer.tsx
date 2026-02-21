'use client';

import { useEffect, useState } from 'react';
import { useViolationStore } from '@/stores/violation-store';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    Shield,
    FileText,
    AlertCircle,
    Check,
    X,
    Loader2,
    BarChart3,
    History,
    TrendingDown,
} from 'lucide-react';

interface EvidenceDrawerProps {
    violationId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EvidenceDrawer({ violationId, open, onOpenChange }: EvidenceDrawerProps) {
    const {
        activeViolation,
        fetchViolation,
        reviewViolation,
        isLoadingDetail,
        isReviewing,
        clearActiveViolation,
    } = useViolationStore();

    const [reviewNote, setReviewNote] = useState('');

    useEffect(() => {
        if (violationId && open) {
            fetchViolation(violationId);
        }
        return () => clearActiveViolation();
    }, [violationId, open, fetchViolation, clearActiveViolation]);

    const handleReview = async (status: 'approved' | 'false_positive') => {
        if (!violationId) return;
        try {
            await reviewViolation(violationId, {
                status,
                review_note: reviewNote || undefined,
            });
            toast.success(
                status === 'approved' ? 'Violation confirmed' : 'Marked as false positive',
                { description: `Violation ${violationId.slice(0, 8)} reviewed.` },
            );
            setReviewNote('');
            onOpenChange(false);
        } catch {
            toast.error('Review failed', {
                description: 'Could not save your review. Please try again.',
            });
        }
    };

    const v = activeViolation;
    const isReviewed = v?.status === 'approved' || v?.status === 'false_positive';

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[60vw] p-0 overflow-hidden">
                {isLoadingDetail || !v ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <div className="flex h-full flex-col">
                        {/* Header */}
                        <SheetHeader className="border-b px-6 py-4">
                            <div className="flex items-center gap-3">
                                <SheetTitle className="flex items-center gap-2 text-lg">
                                    <span className="font-mono-code text-sm text-muted-foreground">
                                        {v.id.slice(0, 8)}
                                    </span>
                                    {v.rule_name}
                                </SheetTitle>
                            </div>
                            <SheetDescription className="flex items-center gap-2">
                                <SeverityBadge severity={v.severity} />
                                <Badge variant="outline">{v.account}</Badge>
                                <Badge
                                    variant={
                                        v.status === 'approved'
                                            ? 'default'
                                            : v.status === 'false_positive'
                                                ? 'secondary'
                                                : 'outline'
                                    }
                                >
                                    {v.status}
                                </Badge>
                            </SheetDescription>
                        </SheetHeader>

                        {/* Body */}
                        <ScrollArea className="flex-1 px-6 py-4">
                            <div className="grid gap-6 lg:grid-cols-2">
                                {/* Left Panel: Policy & Rule */}
                                <div className="space-y-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                <FileText className="h-4 w-4 text-primary" />
                                                Policy Excerpt
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">
                                                {v.policy_excerpt || 'No policy excerpt available'}
                                            </blockquote>
                                            {v.policy_section && (
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Section: {v.policy_section}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                <Shield className="h-4 w-4 text-primary" />
                                                Rule Logic
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="rounded-lg bg-muted p-3 font-mono-code text-xs">
                                                <p>
                                                    <span className="text-muted-foreground">Rule:</span>{' '}
                                                    {v.rule_id}
                                                </p>
                                                <p>
                                                    <span className="text-muted-foreground">Threshold:</span>{' '}
                                                    ${v.threshold?.toLocaleString()}
                                                </p>
                                                <p>
                                                    <span className="text-muted-foreground">Actual:</span>{' '}
                                                    <span className="text-ruby">
                                                        ${v.actual_value?.toLocaleString()}
                                                    </span>
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="flex items-center gap-2 text-sm">
                                                <AlertCircle className="h-4 w-4 text-amber" />
                                                AI Explanation
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground">
                                                {v.explanation || 'No explanation available'}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    {v.historical_context && (
                                        <Card className="border-primary/20 bg-primary/5">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="flex items-center gap-2 text-sm">
                                                    <History className="h-4 w-4 text-primary" />
                                                    Historical Context (GDPR Benchmark)
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                <div className="flex items-center gap-2 rounded-md bg-background p-2 text-xs border">
                                                    <TrendingDown className="h-3 w-3 text-ruby" />
                                                    <span className="font-medium text-muted-foreground">Avg. Historical Fine:</span>
                                                    <span className="font-bold text-ruby">{v.historical_context.avg_fine}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Real-World Breach Example</p>
                                                    <p className="text-xs italic text-muted-foreground">
                                                        "{v.historical_context.breach_example}"
                                                    </p>
                                                </div>
                                                <div className="pt-2 border-t text-[10px] text-muted-foreground flex justify-between">
                                                    <span>Source: Kaggle GDPR Violations</span>
                                                    <span className="font-bold uppercase">{v.historical_context.article_reference}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {v.full_article_text && v.full_article_text.length > 0 && (
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="flex items-center gap-2 text-sm">
                                                    <FileText className="h-4 w-4 text-emerald" />
                                                    Full GDPR Text: {v.historical_context?.article_reference}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ScrollArea className="h-[200px] pr-4">
                                                    <div className="space-y-4">
                                                        {v.full_article_text.map((sub: any, idx: number) => (
                                                            <div key={idx} className="space-y-1">
                                                                <p className="text-[10px] font-bold text-muted-foreground">Paragraph {sub.sub_article}</p>
                                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                                    {sub.gdpr_text}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                                <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground">
                                                    <a 
                                                        href={v.full_article_text[0].href} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="hover:text-primary transition-colors underline"
                                                    >
                                                        Read full article at gdpr-info.eu
                                                    </a>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                {/* Right Panel: Evidence */}
                                <div className="space-y-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Transaction Evidence</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="rounded-lg border p-3">
                                                    <p className="text-xs text-muted-foreground">Amount</p>
                                                    <p className="font-display text-xl font-bold text-ruby">
                                                        ${v.amount?.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg border p-3">
                                                    <p className="text-xs text-muted-foreground">Type</p>
                                                    <p className="text-sm font-medium">
                                                        {v.transaction_type ?? 'N/A'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Evidence fields */}
                                            {v.evidence && Object.keys(v.evidence).length > 0 && (
                                                <div className="rounded-lg bg-muted p-3">
                                                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                                                        Raw Evidence
                                                    </p>
                                                    <div className="space-y-1 font-mono-code text-xs">
                                                        {Object.entries(v.evidence).map(([key, val]) => (
                                                            <div key={key} className="flex gap-2">
                                                                <span className="text-muted-foreground">{key}:</span>
                                                                <span>{String(val)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Accuracy Panel */}
                                    {v.rule_accuracy && (
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="flex items-center gap-2 text-sm">
                                                    <BarChart3 className="h-4 w-4 text-primary" />
                                                    Rule Accuracy
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Precision</p>
                                                        <p className="text-lg font-bold">
                                                            {(v.rule_accuracy.precision * 100).toFixed(0)}%
                                                        </p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Recall</p>
                                                        <p className="text-lg font-bold">
                                                            {(v.rule_accuracy.recall * 100).toFixed(0)}%
                                                        </p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">F1</p>
                                                        <p className="text-lg font-bold">
                                                            {(v.rule_accuracy.f1 * 100).toFixed(0)}%
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Validated against: {v.rule_accuracy.validated_against}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>

                        {/* Action Bar */}
                        <div className="border-t px-6 py-4">
                            {isReviewed ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Check className="h-4 w-4 text-emerald" />
                                    Reviewed as <strong>{v.status}</strong>
                                    {v.reviewed_at && (
                                        <span> on {new Date(v.reviewed_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Input
                                        placeholder="Add a review note (optional)..."
                                        value={reviewNote}
                                        onChange={(e) => setReviewNote(e.target.value)}
                                        disabled={isReviewing}
                                    />
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => handleReview('false_positive')}
                                            disabled={isReviewing}
                                            className="flex-1"
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Mark as False Positive
                                        </Button>
                                        <Button
                                            onClick={() => handleReview('approved')}
                                            disabled={isReviewing}
                                            className="flex-1"
                                        >
                                            {isReviewing ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Check className="mr-2 h-4 w-4" />
                                            )}
                                            Confirm Violation
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
