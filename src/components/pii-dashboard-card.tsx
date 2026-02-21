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
}

export function PIIDashboardCard({ scanId }: PIIDashboardCardProps) {
    const { findings, piiDetected, fetchFindings, isLoading } = usePIIStore();
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        fetchFindings(scanId);
    }, [scanId, fetchFindings]);

    // Don't render if loading, no findings, or all resolved/ignored
    const openFindings = findings.filter(
        (f) => f.status !== 'resolved' && f.status !== 'ignored',
    );

    if (isLoading || openFindings.length === 0) {
        return null;
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
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {openFindings.length} finding{openFindings.length !== 1 ? 's' : ''}
                        {parts.length > 0 && ` (${parts.join(', ')})`}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                        View Details
                    </Button>
                </CardContent>
            </Card>

            <PIIAlertDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </>
    );
}
