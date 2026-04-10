'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Download, Copy, Loader2, FileJson, FileText } from 'lucide-react';
import type { ExportResponse } from '@/lib/contracts';

interface ExportActionsProps {
    scanId: string;
    complianceScore: number;
    totalViolations: number;
    criticalCount: number;
    highCount: number;
    mediumCount?: number;
    falsePositiveCount?: number;
    accountsFlagged?: number;
    recordCount?: number;
    auditName?: string;
}

export function ExportActions({
    scanId,
    complianceScore,
    totalViolations,
    criticalCount,
    highCount,
}: ExportActionsProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const handleExportJSON = async () => {
        setIsExporting(true);
        try {
            const data = await api.get<ExportResponse>(`/export?scan_id=${scanId}&format=json`);

            const blob = new Blob([JSON.stringify(data.report, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yggdrasil-report-${scanId.slice(0, 8)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Report exported', {
                description: 'JSON report downloaded successfully.',
            });
        } catch (err) {
            toast.error('Export failed', {
                description: err instanceof Error ? err.message : 'Could not export report.',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadPDF = async () => {
        setIsPrinting(true);
        try {
            const supabase = (await import('@/lib/supabase-browser')).getSupabaseBrowser();
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = {};
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const { useOrgStore } = await import('@/stores/org-store');
            const orgId = useOrgStore.getState().currentOrg?.id;
            if (orgId) headers['X-Organization-Id'] = orgId;

            const response = await fetch(`/api/export?scan_id=${scanId}&format=pdf`, { headers });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ message: 'PDF generation failed' }));
                throw new Error(err.message || 'PDF generation failed');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `yggdrasil-report-${scanId.slice(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('PDF downloaded', {
                description: 'Compliance report saved as PDF.',
            });
        } catch (err) {
            toast.error('PDF generation failed', {
                description: err instanceof Error ? err.message : 'Could not generate PDF report.',
            });
        } finally {
            setIsPrinting(false);
        }
    };

    const handleCopySummary = () => {
        const scoreEmoji = complianceScore >= 80 ? '🟢' : complianceScore >= 50 ? '🟡' : '🔴';

        const summary = [
            `${scoreEmoji} *Yggdrasil — Compliance Summary*`,
            '',
            `*Score:* ${complianceScore}%`,
            `*Total Violations:* ${totalViolations}`,
            `  • Critical: ${criticalCount}`,
            `  • High: ${highCount}`,
            '',
            `_Scan ID: ${scanId.slice(0, 8)}_`,
            `_Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}_`,
        ].join('\n');

        navigator.clipboard.writeText(summary).then(() => {
            toast.success('Copied to clipboard', {
                description: 'Slack-ready summary copied.',
            });
        }).catch(() => {
            toast.error('Copy failed', {
                description: 'Could not copy to clipboard.',
            });
        });
    };

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                className="gap-2"
            >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy Summary</span>
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" disabled={isExporting}>
                        {isExporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Download className="h-3.5 w-3.5" />
                        )}
                        Export
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportJSON}>
                        <FileJson className="mr-2 h-4 w-4" />
                        Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDownloadPDF} disabled={isPrinting}>
                        {isPrinting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className="mr-2 h-4 w-4" />
                        )}
                        {isPrinting ? 'Generating...' : 'Download PDF'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
