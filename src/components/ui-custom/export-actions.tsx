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
import { Download, Copy, Loader2, FileJson, Printer } from 'lucide-react';
import type { ExportResponse } from '@/lib/contracts';

interface ExportActionsProps {
    scanId: string;
    complianceScore: number;
    totalViolations: number;
    criticalCount: number;
    highCount: number;
}

export function ExportActions({
    scanId,
    complianceScore,
    totalViolations,
    criticalCount,
    highCount,
}: ExportActionsProps) {
    const [isExporting, setIsExporting] = useState(false);

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

    const handlePrintPDF = () => {
        const scoreEmoji = complianceScore >= 80 ? '🟢' : complianceScore >= 50 ? '🟡' : '🔴';
        const dateStr = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Pop-up blocked', { description: 'Please allow pop-ups to print.' });
            return;
        }

        printWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Yggdrasil — Compliance Audit Trail</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1a1a2e;
            padding: 48px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1a1a2e;
            padding-bottom: 24px;
            margin-bottom: 32px;
        }
        
        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .logo-icon {
            width: 40px;
            height: 40px;
            background: #1a1a2e;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
        }
        
        .logo-text h1 {
            font-family: 'Playfair Display', serif;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        
        .logo-text p {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
        }
        
        .meta {
            text-align: right;
            font-size: 12px;
            color: #64748b;
        }
        
        .meta strong { color: #1a1a2e; }
        
        h2 {
            font-family: 'Playfair Display', serif;
            font-size: 20px;
            font-weight: 600;
            margin: 32px 0 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .score-section {
            display: flex;
            align-items: center;
            gap: 32px;
            margin: 24px 0;
            padding: 24px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }
        
        .score-value {
            font-family: 'Playfair Display', serif;
            font-size: 48px;
            font-weight: 700;
        }
        
        .score-good { color: #059b6e; }
        .score-warn { color: #d97706; }
        .score-bad { color: #dc2626; }
        
        .score-details { flex: 1; }
        .score-details p { font-size: 14px; color: #475569; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin: 16px 0;
        }
        
        .stat-box {
            padding: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            text-align: center;
        }
        
        .stat-box .value {
            font-size: 24px;
            font-weight: 700;
        }
        
        .stat-box .label {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
        }
        
        .critical .value { color: #dc2626; }
        .high .value { color: #d97706; }
        
        .footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
        }
        
        @media print {
            body { padding: 24px; }
            .header { page-break-after: avoid; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <div class="logo-icon">🌳</div>
            <div class="logo-text">
                <h1>Yggdrasil</h1>
                <p>Autonomous Compliance Engine</p>
            </div>
        </div>
        <div class="meta">
            <p><strong>Compliance Audit Trail</strong></p>
            <p>${dateStr}</p>
            <p>Scan ID: ${scanId.slice(0, 8)}</p>
        </div>
    </div>
    
    <h2>Compliance Score</h2>
    <div class="score-section">
        <div class="score-value ${complianceScore >= 80 ? 'score-good' : complianceScore >= 50 ? 'score-warn' : 'score-bad'}">
            ${scoreEmoji} ${complianceScore}%
        </div>
        <div class="score-details">
            <p><strong>Overall compliance rating</strong></p>
            <p>${complianceScore >= 80 ? 'Your data meets compliance thresholds.' : complianceScore >= 50 ? 'Review recommended — some violations detected.' : 'Immediate action required — critical violations found.'}</p>
        </div>
    </div>
    
    <h2>Violation Summary</h2>
    <div class="stats-grid">
        <div class="stat-box">
            <div class="value">${totalViolations}</div>
            <div class="label">Total Violations</div>
        </div>
        <div class="stat-box critical">
            <div class="value">${criticalCount}</div>
            <div class="label">Critical</div>
        </div>
        <div class="stat-box high">
            <div class="value">${highCount}</div>
            <div class="label">High Risk</div>
        </div>
    </div>
    
    <h2>Audit Trail</h2>
    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:12px;">
        <thead>
            <tr style="border-bottom:2px solid #e2e8f0; text-align:left;">
                <th style="padding:8px 12px; color:#64748b; font-weight:600;">Timestamp</th>
                <th style="padding:8px 12px; color:#64748b; font-weight:600;">Action</th>
                <th style="padding:8px 12px; color:#64748b; font-weight:600;">Details</th>
            </tr>
        </thead>
        <tbody>
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 12px; color:#64748b;">${dateStr}</td>
                <td style="padding:8px 12px; font-weight:500;">Scan Completed</td>
                <td style="padding:8px 12px;">Scan ID ${scanId.slice(0, 8)} finished processing</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 12px; color:#64748b;">${dateStr}</td>
                <td style="padding:8px 12px; font-weight:500;">Violations Detected</td>
                <td style="padding:8px 12px;">${totalViolations} violations flagged (${criticalCount} critical, ${highCount} high)</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 12px; color:#64748b;">${dateStr}</td>
                <td style="padding:8px 12px; font-weight:500;">Score Calculated</td>
                <td style="padding:8px 12px;">Compliance score: ${complianceScore}%</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 12px; color:#64748b;">${dateStr}</td>
                <td style="padding:8px 12px; font-weight:500;">Report Generated</td>
                <td style="padding:8px 12px;">Audit trail exported via Yggdrasil</td>
            </tr>
        </tbody>
    </table>
    
    <div class="footer">
        <span>Generated by Yggdrasil — Autonomous Compliance Engine</span>
        <span>Confidential — Internal Use Only</span>
    </div>
    
    <script>
        window.onload = function() { window.print(); };
    </script>
</body>
</html>
        `);
        printWindow.document.close();

        toast.success('Print dialog opened', {
            description: 'Use "Save as PDF" in the print dialog to save.',
        });
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
                    <DropdownMenuItem onClick={handlePrintPDF}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print as PDF
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
