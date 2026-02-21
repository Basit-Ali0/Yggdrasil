'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, AlertTriangle, Users, ChevronDown, ArrowRight } from 'lucide-react';
import type { ViolationCase } from '@/lib/contracts';

// -- Aggregation types --
interface AccountEntry {
    account_id: string;
    violation_count: number;
    total_amount: number;
    violation_ids: string[];
}

interface RuleGroup {
    rule_id: string;
    violation_count: number;
    accounts: AccountEntry[];
}

interface SeverityGroup {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    violation_count: number;
    account_count: number;
    rules: RuleGroup[];
}

function buildAggregation(cases: ViolationCase[]): SeverityGroup[] {
    const severityMap = new Map<string, Map<string, Map<string, { count: number; amount: number; violationIds: string[] }>>>();

    for (const c of cases) {
        for (const v of c.violations) {
            const sev = v.severity;
            const rule = v.rule_id;
            const account = c.account_id;

            if (!severityMap.has(sev)) severityMap.set(sev, new Map());
            const ruleMap = severityMap.get(sev)!;

            if (!ruleMap.has(rule)) ruleMap.set(rule, new Map());
            const accountMap = ruleMap.get(rule)!;

            if (!accountMap.has(account)) accountMap.set(account, { count: 0, amount: 0, violationIds: [] });
            const entry = accountMap.get(account)!;
            entry.count++;
            entry.amount += v.amount;
            entry.violationIds.push(v.id);
        }
    }

    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM'] as const;
    const groups: SeverityGroup[] = [];

    for (const sev of severityOrder) {
        const ruleMap = severityMap.get(sev);
        if (!ruleMap) continue;

        const uniqueAccounts = new Set<string>();
        let totalViolations = 0;
        const rules: RuleGroup[] = [];

        for (const [ruleId, accountMap] of ruleMap) {
            const accounts: AccountEntry[] = [];
            let ruleViolationCount = 0;

            for (const [accountId, entry] of accountMap) {
                uniqueAccounts.add(accountId);
                ruleViolationCount += entry.count;
                accounts.push({
                    account_id: accountId,
                    violation_count: entry.count,
                    total_amount: entry.amount,
                    violation_ids: entry.violationIds,
                });
            }

            totalViolations += ruleViolationCount;
            rules.push({
                rule_id: ruleId,
                violation_count: ruleViolationCount,
                accounts: accounts.sort((a, b) => b.total_amount - a.total_amount),
            });
        }

        rules.sort((a, b) => b.violation_count - a.violation_count);

        groups.push({
            severity: sev,
            violation_count: totalViolations,
            account_count: uniqueAccounts.size,
            rules,
        });
    }

    return groups;
}

export default function DashboardPage() {
    const params = useParams();
    const scanId = params.scanId as string;

    const {
        cases, complianceScore, totalCases, totalViolations,
        fetchCases, fetchScore, isLoadingCases, error, scoreDetails,
    } = useViolationStore();
    const { currentScan } = useScanStore();

    const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        fetchCases(scanId);
        fetchScore(scanId);
    }, [scanId, fetchCases, fetchScore]);

    const aggregation = useMemo(() => buildAggregation(cases), [cases]);

    if (error) {
        return <ErrorState message={error} onRetry={() => fetchCases(scanId)} />;
    }

    if (isLoadingCases) {
        return <DashboardSkeleton />;
    }

    const criticalCount = scoreDetails?.by_severity?.CRITICAL ?? 0;
    const highCount = scoreDetails?.by_severity?.HIGH ?? 0;

    const auditName = currentScan?.audit_name;

    const handleViolationClick = (violationId: string) => {
        setSelectedViolationId(violationId);
        setDrawerOpen(true);
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            {/* Header with Export */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {auditName || 'Compliance Dashboard'}
                    </h1>
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

            {/* Aggregated Violations */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                            Violation Summary
                            {totalViolations > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                    {totalViolations} total
                                </Badge>
                            )}
                        </span>
                        {cases.length > 0 && (
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/${scanId}/cases`} className="gap-1.5">
                                    View All Cases
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {aggregation.length === 0 ? (
                        <EmptyState
                            icon={ShieldAlert}
                            title="No violations found"
                            description="Your data appears compliant with the selected policy."
                        />
                    ) : (
                        <div className="space-y-2">
                            {aggregation.map((sevGroup) => (
                                <Collapsible key={sevGroup.severity} className="rounded-lg border">
                                    <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 [&[data-state=open]>svg:first-child]:rotate-90">
                                        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200" />
                                        <SeverityBadge severity={sevGroup.severity} />
                                        <span className="text-sm text-muted-foreground">
                                            {sevGroup.violation_count} violation{sevGroup.violation_count !== 1 ? 's' : ''}, {sevGroup.account_count} account{sevGroup.account_count !== 1 ? 's' : ''}
                                        </span>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent>
                                        <div className="border-t px-4 pb-3 pt-1">
                                            {sevGroup.rules.map((ruleGroup) => (
                                                <Collapsible key={ruleGroup.rule_id} className="mt-2">
                                                    <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50 [&[data-state=open]>svg:first-child]:rotate-90">
                                                        <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200" />
                                                        <span className="font-medium">{ruleGroup.rule_id}</span>
                                                        <Badge variant="secondary" className="ml-auto text-xs">
                                                            {ruleGroup.violation_count}
                                                        </Badge>
                                                    </CollapsibleTrigger>

                                                    <CollapsibleContent>
                                                        <div className="ml-8 mt-1 space-y-1">
                                                            {ruleGroup.accounts.map((acc) => (
                                                                <button
                                                                    key={acc.account_id}
                                                                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                                                                    onClick={() => acc.violation_ids[0] && handleViolationClick(acc.violation_ids[0])}
                                                                >
                                                                    <span className="font-mono-code">
                                                                        {acc.account_id}
                                                                    </span>
                                                                    <span className="font-mono-code">
                                                                        ${acc.total_amount.toLocaleString()}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Evidence Drawer */}
            <EvidenceDrawer
                violationId={selectedViolationId}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
            />
        </div>
    );
}
