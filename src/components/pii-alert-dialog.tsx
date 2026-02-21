'use client';

import { usePIIStore } from '@/stores/pii-store';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

interface PIIAlertDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProceed?: () => void;
}

const severityColors: Record<string, string> = {
    CRITICAL: 'bg-ruby/10 text-ruby border-ruby/20',
    HIGH: 'bg-amber/10 text-amber border-amber/20',
    MEDIUM: 'bg-muted text-muted-foreground border-border',
};

export function PIIAlertDialog({ open, onOpenChange, onProceed }: PIIAlertDialogProps) {
    const { findings, summary, resolveFinding } = usePIIStore();

    const openFindings = findings.filter(
        (f) => f.status !== 'resolved' && f.status !== 'ignored',
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-ruby">
                        <ShieldAlert className="h-5 w-5" />
                        PII Detected in Your Dataset
                    </DialogTitle>
                    <DialogDescription>
                        {summary || `${openFindings.length} column${openFindings.length !== 1 ? 's' : ''} may contain personally identifiable information.`}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3 pr-4">
                        {findings.map((finding, idx) => {
                            const isResolved = finding.status === 'resolved' || finding.status === 'ignored';
                            return (
                                <Card
                                    key={finding.id ?? `${finding.column_name}-${idx}`}
                                    className={isResolved ? 'opacity-50' : ''}
                                >
                                    <CardContent className="p-4 space-y-2">
                                        {/* Header: column name + severity + PII type */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-medium">
                                                    {finding.column_name}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {finding.pii_type.replace(/_/g, ' ')}
                                                </Badge>
                                            </div>
                                            <span
                                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                                                    severityColors[finding.severity] ?? severityColors.MEDIUM
                                                }`}
                                            >
                                                {finding.severity}
                                            </span>
                                        </div>

                                        {/* Match count */}
                                        <p className="text-sm text-muted-foreground">
                                            {finding.match_count.toLocaleString()} / {finding.total_rows.toLocaleString()} rows matched
                                            ({finding.match_percentage}%)
                                        </p>

                                        {/* Masked samples */}
                                        {finding.masked_samples.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {finding.masked_samples.map((sample, sIdx) => (
                                                    <code
                                                        key={sIdx}
                                                        className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
                                                    >
                                                        {sample}
                                                    </code>
                                                ))}
                                            </div>
                                        )}

                                        {/* Suggestion */}
                                        <p className="text-xs text-muted-foreground">
                                            {finding.suggestion}
                                        </p>

                                        {/* Actions */}
                                        {!isResolved && finding.id && (
                                            <div className="flex gap-2 pt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => resolveFinding(finding.id!, 'resolved')}
                                                >
                                                    Mark Resolved
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => resolveFinding(finding.id!, 'ignored')}
                                                >
                                                    Ignore
                                                </Button>
                                            </div>
                                        )}

                                        {isResolved && (
                                            <Badge variant="secondary" className="text-xs">
                                                {finding.status}
                                            </Badge>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Go Back
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            onOpenChange(false);
                            onProceed?.();
                        }}
                    >
                        Proceed Anyway
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
