'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useViolationStore } from '@/stores/violation-store';
import { useScanStore } from '@/stores/scan-store';
import { StatCard } from '@/components/ui-custom/stat-card';
import { ScoreGauge } from '@/components/ui-custom/score-gauge';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import { ErrorState } from '@/components/ui-custom/error-state';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { ExportActions } from '@/components/ui-custom/export-actions';
import { DashboardSkeleton } from '@/components/ui-custom/loading-skeleton';
import { EvidenceDrawer } from '@/components/evidence-drawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, AlertTriangle, Users, TrendingUp, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DashboardPage() {
    const params = useParams();
    const scanId = params.scanId as string;

    const {
        cases, complianceScore, totalCases, totalViolations,
        fetchCases, fetchScore, isLoadingCases, error, scoreDetails,
    } = useViolationStore();
    const { scanHistory, fetchHistory } = useScanStore();

    const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        fetchCases(scanId);
        fetchScore(scanId);
        fetchHistory();
    }, [scanId, fetchCases, fetchScore, fetchHistory]);

    if (error) {
        return <ErrorState message={error} onRetry={() => fetchCases(scanId)} />;
    }

    if (isLoadingCases) {
        return <DashboardSkeleton />;
    }

    const criticalCount = scoreDetails?.by_severity?.CRITICAL ?? 0;
    const highCount = scoreDetails?.by_severity?.HIGH ?? 0;

    // Trend data from scan history
    const trendData = scanHistory.map((s) => ({
        date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: s.score,
        violations: s.violation_count,
    }));

    const handleViolationClick = (violationId: string) => {
        setSelectedViolationId(violationId);
        setDrawerOpen(true);
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            {/* Header with Export */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Compliance Dashboard</h1>
                    <p className="mt-1 text-muted-foreground">
                        Scan results and compliance score for your audit.
                    </p>
                </div>
                <ExportActions
                    scanId={scanId}
                    complianceScore={complianceScore}
                    totalViolations={totalViolations}
                    criticalCount={criticalCount}
                    highCount={highCount}
                />
            </div>

            {/* Top Stats Row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 children-stagger">
                <Card className="flex items-center justify-center p-6">
                    <ScoreGauge score={complianceScore} size="md" />
                </Card>
                <StatCard
                    title="Critical Violations"
                    value={criticalCount}
                    icon={ShieldAlert}
                    variant="critical"
                />
                <StatCard
                    title="High Risk"
                    value={highCount}
                    icon={AlertTriangle}
                    variant="warning"
                />
                <StatCard
                    title="Accounts Flagged"
                    value={totalCases}
                    icon={Users}
                />
            </div>

            {/* Main Content: 2 panels */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left: Cases Table */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Search className="h-4 w-4" />
                            Account Cases
                            {totalViolations > 0 && (
                                <Badge variant="secondary" className="ml-auto text-xs">
                                    {totalViolations} total
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {cases.length === 0 ? (
                            <EmptyState
                                icon={ShieldAlert}
                                title="No violations found"
                                description="Your data appears compliant with the selected policy."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Account</TableHead>
                                            <TableHead>Violations</TableHead>
                                            <TableHead>Severity</TableHead>
                                            <TableHead className="hidden sm:table-cell">Top Rule</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cases.map((c) => (
                                            <TableRow
                                                key={c.account_id}
                                                className="cursor-pointer transition-colors hover:bg-muted/50"
                                                onClick={() =>
                                                    c.violations[0] && handleViolationClick(c.violations[0].id)
                                                }
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && c.violations[0]) {
                                                        handleViolationClick(c.violations[0].id);
                                                    }
                                                }}
                                                role="button"
                                                aria-label={`View violations for account ${c.account_id}`}
                                            >
                                                <TableCell className="font-mono-code text-sm">
                                                    {c.account_id}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {c.violation_count}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <SeverityBadge severity={c.max_severity} />
                                                </TableCell>
                                                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                                                    {c.top_rule}
                                                </TableCell>
                                                <TableCell className="text-right font-mono-code text-sm">
                                                    ${c.total_amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right: Scan History + Trends */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-4 w-4" />
                            Scan Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {trendData.length > 1 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="score"
                                        stroke="var(--azure)"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: 'var(--azure)' }}
                                        activeDot={{ r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                                Run more scans to see trends
                            </div>
                        )}

                        {/* History List */}
                        <div className="mt-4 space-y-2">
                            {scanHistory.slice(0, 5).map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                                >
                                    <span className="text-muted-foreground">
                                        {new Date(s.created_at).toLocaleDateString()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">{s.violation_count} issues</Badge>
                                        <span className="font-medium">{s.score}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Evidence Drawer */}
            <EvidenceDrawer
                violationId={selectedViolationId}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
            />
        </div>
    );
}
