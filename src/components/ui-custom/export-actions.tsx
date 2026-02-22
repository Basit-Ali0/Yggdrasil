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
    mediumCount = 0,
    falsePositiveCount = 0,
    accountsFlagged = 0,
    recordCount,
    auditName,
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

    const handlePrintPDF = async () => {
        setIsPrinting(true);
        try {
            const data = await api.get<ExportResponse>(`/export?scan_id=${scanId}&format=json`);
            const violations = data.report.violations ?? [];

            const scoreIndicator = complianceScore >= 80 ? '[PASS]' : complianceScore >= 50 ? '[WARN]' : '[FAIL]';
            const scoreClass = complianceScore >= 80 ? 'score-good' : complianceScore >= 50 ? 'score-warn' : 'score-bad';
            const scoreInterpretation = complianceScore >= 80
                ? 'Your data meets compliance thresholds. No immediate action required.'
                : complianceScore >= 50
                    ? 'Review recommended — some violations detected that require attention.'
                    : 'Immediate action required — critical violations found that pose significant risk.';

            const dateStr = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            const mediumCount = violations.filter(v => v.severity === 'MEDIUM').length;
            const severityOrder: Array<'CRITICAL' | 'HIGH' | 'MEDIUM'> = ['CRITICAL', 'HIGH', 'MEDIUM'];
            const severityColors: Record<string, { bg: string; text: string; border: string }> = {
                CRITICAL: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
                HIGH: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
                MEDIUM: { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
            };

            const escapeHtml = (str: string) =>
                String(str ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');

            const formatAmount = (val: number) =>
                typeof val === 'number' ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(val ?? 'N/A');

            const MAX_PER_SEVERITY = 50;

            // Build rule summary table (always shows full counts)
            const ruleGroups = new Map<string, { rule_id: string; rule_name: string; severity: string; count: number; topAccount: string; totalAmount: number }>();
            for (const v of violations) {
                const key = v.rule_id;
                if (!ruleGroups.has(key)) {
                    ruleGroups.set(key, { rule_id: v.rule_id, rule_name: v.rule_name, severity: v.severity, count: 0, topAccount: v.account, totalAmount: 0 });
                }
                const g = ruleGroups.get(key)!;
                g.count++;
                g.totalAmount += typeof v.amount === 'number' ? v.amount : 0;
            }

            let summaryTableHtml = '';
            if (violations.length > MAX_PER_SEVERITY) {
                const ruleRows = Array.from(ruleGroups.values())
                    .sort((a, b) => b.count - a.count)
                    .map(g => `
                        <tr>
                            <td style="font-family:monospace;font-size:12px;">${escapeHtml(g.rule_id)}</td>
                            <td><span class="severity-pill" style="background:${severityColors[g.severity]?.bg ?? '#f8fafc'}; color:${severityColors[g.severity]?.text ?? '#1a1a2e'}; border:1px solid ${severityColors[g.severity]?.border ?? '#e2e8f0'}; font-size:10px; padding:2px 8px;">${g.severity}</span></td>
                            <td style="text-align:right;font-weight:600;">${g.count}</td>
                            <td style="font-family:monospace;font-size:12px;">${escapeHtml(g.topAccount)}</td>
                            <td style="text-align:right;">$${formatAmount(g.totalAmount / g.count)}</td>
                        </tr>
                    `).join('');

                summaryTableHtml = `
                    <h2>Violation Breakdown by Rule</h2>
                    <table class="audit-table" style="margin-bottom:24px;">
                        <thead><tr>
                            <th>Rule ID</th>
                            <th>Severity</th>
                            <th style="text-align:right;">Count</th>
                            <th>Top Account</th>
                            <th style="text-align:right;">Avg Amount</th>
                        </tr></thead>
                        <tbody>${ruleRows}</tbody>
                    </table>
                `;
            }

            // Build violation detail sections grouped by severity (capped)
            let violationSectionsHtml = summaryTableHtml;
            let isTruncated = false;

            for (const severity of severityOrder) {
                const group = violations.filter(v => v.severity === severity);
                if (group.length === 0) continue;

                const displayGroup = group.slice(0, MAX_PER_SEVERITY);
                const overflow = group.length - displayGroup.length;
                if (overflow > 0) isTruncated = true;

                const colors = severityColors[severity];
                violationSectionsHtml += `
                    <h2 style="page-break-before: always;">${severity} Violations (${group.length})</h2>
                `;

                for (const v of displayGroup) {
                    const statusLabel = v.status === 'approved' ? 'Approved'
                        : v.status === 'false_positive' ? 'False Positive'
                        : v.status === 'disputed' ? 'Disputed'
                        : 'Pending Review';

                    violationSectionsHtml += `
                    <div class="violation-card" style="page-break-inside: avoid;">
                        <div class="violation-header">
                            <div>
                                <span class="violation-title">${escapeHtml(v.rule_name)}</span>
                                <span class="rule-id">${escapeHtml(v.rule_id)}</span>
                            </div>
                            <span class="severity-pill" style="background:${colors.bg}; color:${colors.text}; border:1px solid ${colors.border};">
                                ${severity}
                            </span>
                        </div>

                        <div class="evidence-grid">
                            <div class="evidence-item">
                                <div class="evidence-label">Account</div>
                                <div class="evidence-value">${escapeHtml(v.account)}</div>
                            </div>
                            <div class="evidence-item">
                                <div class="evidence-label">Amount</div>
                                <div class="evidence-value">$${formatAmount(v.amount)}</div>
                            </div>
                            <div class="evidence-item">
                                <div class="evidence-label">Threshold</div>
                                <div class="evidence-value">${formatAmount(v.threshold)}</div>
                            </div>
                            <div class="evidence-item">
                                <div class="evidence-label">Actual Value</div>
                                <div class="evidence-value">${formatAmount(v.actual_value)}</div>
                            </div>
                        </div>

                        <div class="explanation-box">
                            <div class="explanation-label">AI Explanation</div>
                            <p>${escapeHtml(v.explanation)}</p>
                        </div>

                        <blockquote class="policy-excerpt">
                            <div class="policy-label">Policy Excerpt</div>
                            <p>${escapeHtml(v.policy_excerpt)}</p>
                        </blockquote>

                        ${v.status !== 'pending' ? `
                        <div class="review-status">
                            <span class="review-label">Review Status:</span> ${statusLabel}
                            ${v.review_note ? `<span class="review-note"> — ${escapeHtml(v.review_note)}</span>` : ''}
                        </div>
                        ` : ''}
                    </div>
                    `;
                }

                if (overflow > 0) {
                    violationSectionsHtml += `
                    <div style="padding:16px 20px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; text-align:center; color:#64748b; font-size:13px; margin-bottom:20px;">
                        + ${overflow} more ${severity} violation${overflow !== 1 ? 's' : ''} not shown individually.
                        <br><span style="font-size:11px;">Export as JSON for the complete dataset.</span>
                    </div>
                    `;
                }
            }

            if (isTruncated) {
                violationSectionsHtml += `
                <div style="padding:20px; background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; margin:24px 0; font-size:13px; color:#92400e;">
                    <strong>Note:</strong> This report shows the top ${MAX_PER_SEVERITY} violations per severity level.
                    For the complete dataset with all ${totalViolations} violations, export as JSON.
                </div>
                `;
            }

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
    <title>Yggdrasil — Compliance Audit Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1a1a2e;
            padding: 48px;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
        }

        /* ── Header ─────────────────────────────────────────── */
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
        }

        .logo-icon svg { width: 24px; height: 24px; }

        .logo-text h1 {
            font-family: 'Libre Baskerville', serif;
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

        /* ── Headings ───────────────────────────────────────── */
        h2 {
            font-family: 'Libre Baskerville', serif;
            font-size: 20px;
            font-weight: 700;
            margin: 32px 0 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
        }

        /* ── Score Section ──────────────────────────────────── */
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
            font-family: 'Libre Baskerville', serif;
            font-size: 48px;
            font-weight: 700;
            white-space: nowrap;
        }

        .score-indicator {
            font-size: 16px;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            display: block;
            margin-top: 4px;
        }

        .score-good { color: #059b6e; }
        .score-warn { color: #d97706; }
        .score-bad { color: #dc2626; }

        .score-details { flex: 1; }
        .score-details p { font-size: 14px; color: #475569; }

        /* ── Stats Grid ─────────────────────────────────────── */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
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

        .stat-total .value { color: #1a1a2e; }
        .stat-critical .value { color: #dc2626; }
        .stat-high .value { color: #d97706; }
        .stat-medium .value { color: #2563eb; }

        /* ── Violation Cards ────────────────────────────────── */
        .violation-card {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
            background: #fff;
        }

        .violation-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }

        .violation-title {
            font-weight: 600;
            font-size: 15px;
            display: block;
        }

        .rule-id {
            font-size: 12px;
            color: #64748b;
            font-family: monospace;
        }

        .severity-pill {
            font-size: 11px;
            font-weight: 600;
            padding: 3px 10px;
            border-radius: 9999px;
            white-space: nowrap;
        }

        .evidence-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }

        .evidence-item {
            background: #f8fafc;
            border-radius: 6px;
            padding: 10px;
        }

        .evidence-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 500;
            margin-bottom: 2px;
        }

        .evidence-value {
            font-size: 13px;
            font-weight: 600;
            word-break: break-all;
        }

        .explanation-box {
            border-left: 3px solid #3b82f6;
            background: #eff6ff;
            padding: 12px 16px;
            border-radius: 0 6px 6px 0;
            margin-bottom: 12px;
        }

        .explanation-label {
            font-size: 11px;
            font-weight: 600;
            color: #1d4ed8;
            margin-bottom: 4px;
        }

        .explanation-box p {
            font-size: 13px;
            color: #1e3a5f;
            line-height: 1.5;
        }

        .policy-excerpt {
            border-left: 3px solid #cbd5e1;
            background: #f8fafc;
            padding: 12px 16px;
            border-radius: 0 6px 6px 0;
            margin-bottom: 12px;
        }

        .policy-label {
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            margin-bottom: 4px;
        }

        .policy-excerpt p {
            font-size: 13px;
            color: #475569;
            line-height: 1.5;
            font-style: italic;
        }

        .review-status {
            font-size: 12px;
            color: #475569;
            padding-top: 8px;
            border-top: 1px solid #f1f5f9;
        }

        .review-label { font-weight: 600; }
        .review-note { color: #64748b; }

        /* ── Audit Trail Table ──────────────────────────────── */
        .audit-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 12px;
        }

        .audit-table thead tr {
            border-bottom: 2px solid #e2e8f0;
            text-align: left;
        }

        .audit-table th {
            padding: 8px 12px;
            color: #64748b;
            font-weight: 600;
        }

        .audit-table td {
            padding: 8px 12px;
        }

        .audit-table tbody tr {
            border-bottom: 1px solid #f1f5f9;
        }

        .audit-table .ts { color: #64748b; }
        .audit-table .action { font-weight: 500; }

        /* ── Footer ─────────────────────────────────────────── */
        .footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
        }

        /* ── Print ──────────────────────────────────────────── */
        @media print {
            body { padding: 24px; }
            .header { page-break-after: avoid; }
            .violation-card { page-break-inside: avoid; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <!-- ════════ PAGE 1: EXECUTIVE SUMMARY ════════ -->
    <div class="header">
        <div class="logo">
            <div class="logo-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22V8"/>
                    <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
                    <path d="m8 8 4-4 4 4"/>
                    <path d="M12 4v4"/>
                </svg>
            </div>
            <div class="logo-text">
                <h1>Yggdrasil</h1>
                <p>Compliance Audit Report</p>
            </div>
        </div>
        <div class="meta">
            <p><strong>Compliance Audit Report</strong></p>
            <p>${dateStr}</p>
            <p>Scan ID: ${escapeHtml(scanId.slice(0, 8))}</p>
        </div>
    </div>

    <h2>Compliance Score</h2>
    <div class="score-section">
        <div class="score-value ${scoreClass}">
            ${complianceScore}%
            <span class="score-indicator ${scoreClass}">${scoreIndicator}</span>
        </div>
        <div class="score-details">
            <p><strong>Overall compliance rating</strong></p>
            <p>${scoreInterpretation}</p>
        </div>
    </div>

    <h2>Violation Summary</h2>
    <div class="stats-grid">
        <div class="stat-box stat-total">
            <div class="value">${totalViolations}</div>
            <div class="label">Total Violations</div>
        </div>
        <div class="stat-box stat-critical">
            <div class="value">${criticalCount}</div>
            <div class="label">Critical</div>
        </div>
        <div class="stat-box stat-high">
            <div class="value">${highCount}</div>
            <div class="label">High</div>
        </div>
        <div class="stat-box stat-medium">
            <div class="value">${mediumCount}</div>
            <div class="label">Medium</div>
        </div>
    </div>

    <!-- ════════ PAGES 2+: VIOLATION DETAILS ════════ -->
    ${violationSectionsHtml}

    <!-- ════════ FINAL SECTION: AUDIT TRAIL ════════ -->
    <h2>Audit Trail</h2>
    <table class="audit-table">
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="ts">${dateStr}</td>
                <td class="action">Scan Completed</td>
                <td>Scan ID ${escapeHtml(scanId.slice(0, 8))} finished processing</td>
            </tr>
            <tr>
                <td class="ts">${dateStr}</td>
                <td class="action">Violations Detected</td>
                <td>${totalViolations} violations flagged (${criticalCount} critical, ${highCount} high, ${mediumCount} medium)</td>
            </tr>
            <tr>
                <td class="ts">${dateStr}</td>
                <td class="action">Score Calculated</td>
                <td>Compliance score: ${complianceScore}%</td>
            </tr>
            <tr>
                <td class="ts">${dateStr}</td>
                <td class="action">Report Generated</td>
                <td>Full audit report exported via Yggdrasil</td>
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
        const scoreLabel = complianceScore >= 80 ? 'PASS' : complianceScore >= 50 ? 'WARN' : 'FAIL';
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const lines = [
            `${scoreEmoji} *Yggdrasil — Compliance Audit Report*`,
            '',
        ];

        if (auditName) {
            lines.push(`*Audit:* ${auditName}`);
        }
        lines.push(`*Score:* ${complianceScore}% [${scoreLabel}]`);
        lines.push('');
        lines.push(`*Violations:* ${totalViolations}${accountsFlagged > 0 ? ` across ${accountsFlagged} accounts` : ''}`);
        lines.push(`  • Critical: ${criticalCount}`);
        lines.push(`  • High: ${highCount}`);
        lines.push(`  • Medium: ${mediumCount}`);
        lines.push('');
        if (recordCount) {
            lines.push(`*Dataset:* ${recordCount.toLocaleString()} rows scanned`);
        }
        if (falsePositiveCount > 0) {
            lines.push(`*False Positives:* ${falsePositiveCount} dismissed`);
        }
        lines.push(`*Scan Date:* ${dateStr}`);
        lines.push('');
        lines.push('─────────────────────────');
        lines.push('Powered by Yggdrasil — Autonomous Compliance Engine');

        navigator.clipboard.writeText(lines.join('\n')).then(() => {
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
                    <DropdownMenuItem onClick={handlePrintPDF} disabled={isPrinting}>
                        {isPrinting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Printer className="mr-2 h-4 w-4" />
                        )}
                        {isPrinting ? 'Generating...' : 'Print as PDF'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
