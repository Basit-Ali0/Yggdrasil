'use client';

import { useEffect, useState } from 'react';
import { usePIIStore } from '@/stores/pii-store';
import { PIIAlertDialog } from '@/components/pii-alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface PIIDashboardCardProps {
    scanId: string;
    uploadId?: string;
}

export function PIIDashboardCard({ scanId, uploadId }: PIIDashboardCardProps) {
    const { findings, piiDetected, fetchFindings, isLoading } = usePIIStore();
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        fetchFindings(scanId, uploadId);
    }, [scanId, uploadId, fetchFindings]);

    // Don't render if loading, no findings, or all resolved/ignored
    const openFindings = findings.filter(
        (f) => f.status !== 'resolved' && f.status !== 'ignored',
    );

    if (isLoading) {
        return null;
    }

    if (openFindings.length === 0) {
        return (
            <Card className="border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <ShieldAlert className="h-8 w-8 text-emerald mb-2" />
                    <p className="text-sm font-medium">No PII Detected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        No personally identifiable information was found in this dataset.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const criticalCount = openFindings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = openFindings.filter((f) => f.severity === 'HIGH').length;

    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical`);
    if (highCount > 0) parts.push(`${highCount} high`);

    return (
        <>
            <Card className="border-ruby/20 bg-ruby/5">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldAlert className="h-4 w-4 text-ruby" />
                        PII Alerts
                        <Badge variant="destructive" className="ml-1 text-xs">
                            {openFindings.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                            {openFindings.length} finding{openFindings.length !== 1 ? 's' : ''} detected that may contain personally identifiable information:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {openFindings.slice(0, 5).map((f, i) => (
                                <Badge key={i} variant="outline" className="bg-ruby/5 border-ruby/20 text-[10px] py-0">
                                    {f.column_name}: {f.pii_type.replace(/_/g, ' ')}
                                </Badge>
                            ))}
                            {openFindings.length > 5 && (
                                <span className="text-[10px] text-muted-foreground">
                                    + {openFindings.length - 5} more
                                </span>
                            )}
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                        View Details
                    </Button>
                </CardContent>
            </Card>

            <PIIAlertDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </>
    );
}
