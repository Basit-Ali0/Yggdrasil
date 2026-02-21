'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Fuse from 'fuse.js';
import { useViolationStore } from '@/stores/violation-store';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import { ErrorState } from '@/components/ui-custom/error-state';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { DashboardSkeleton } from '@/components/ui-custom/loading-skeleton';
import { EvidenceDrawer } from '@/components/evidence-drawer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, ArrowLeft, ArrowUpDown, Search } from 'lucide-react';
import type { ViolationCase } from '@/lib/contracts';

type SortField = 'account_id' | 'violation_count' | 'max_severity' | 'total_amount';
type SortDir = 'asc' | 'desc';

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };

function sortCases(cases: ViolationCase[], field: SortField, dir: SortDir): ViolationCase[] {
    const sorted = [...cases];
    sorted.sort((a, b) => {
        let cmp = 0;
        switch (field) {
            case 'account_id':
                cmp = a.account_id.localeCompare(b.account_id);
                break;
            case 'violation_count':
                cmp = a.violation_count - b.violation_count;
                break;
            case 'max_severity':
                cmp = (SEVERITY_ORDER[a.max_severity] ?? 0) - (SEVERITY_ORDER[b.max_severity] ?? 0);
                break;
            case 'total_amount':
                cmp = a.total_amount - b.total_amount;
                break;
        }
        return dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
}

export default function CasesPage() {
    const params = useParams();
    const scanId = params.scanId as string;

    const {
        cases, totalViolations,
        fetchCases, isLoadingCases, error,
    } = useViolationStore();

    const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('max_severity');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    useEffect(() => {
        fetchCases(scanId);
    }, [scanId, fetchCases]);

    const fuse = useMemo(
        () =>
            new Fuse(cases, {
                keys: ['account_id', 'top_rule', 'max_severity'],
                threshold: 0.3,
                ignoreLocation: true,
            }),
        [cases],
    );

    const filteredCases = useMemo(() => {
        const base = searchQuery.trim()
            ? fuse.search(searchQuery).map((r) => r.item)
            : cases;
        return sortCases(base, sortField, sortDir);
    }, [cases, searchQuery, fuse, sortField, sortDir]);

    if (error) {
        return <ErrorState message={error} onRetry={() => fetchCases(scanId)} />;
    }

    if (isLoadingCases) {
        return <DashboardSkeleton />;
    }

    const handleViolationClick = (violationId: string) => {
        setSelectedViolationId(violationId);
        setDrawerOpen(true);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort(field)}
        >
            <span className="inline-flex items-center gap-1">
                {children}
                <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
            </span>
        </TableHead>
    );

    return (
        <div className="animate-fade-in-up space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="shrink-0">
                        <Link href={`/dashboard/${scanId}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">All Cases</h1>
                        <p className="mt-1 text-muted-foreground">
                            {totalViolations} violation{totalViolations !== 1 ? 's' : ''} across {cases.length} account{cases.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by account, rule, severity..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Cases Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        Account Cases
                        {filteredCases.length !== cases.length && (
                            <Badge variant="secondary" className="text-xs">
                                {filteredCases.length} of {cases.length}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredCases.length === 0 ? (
                        <EmptyState
                            icon={ShieldAlert}
                            title={searchQuery ? 'No matching cases' : 'No violations found'}
                            description={searchQuery ? 'Try a different search term.' : 'Your data appears compliant with the selected policy.'}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortHeader field="account_id">Account</SortHeader>
                                        <SortHeader field="violation_count">Violations</SortHeader>
                                        <SortHeader field="max_severity">Severity</SortHeader>
                                        <TableHead className="hidden sm:table-cell">Top Rule</TableHead>
                                        <SortHeader field="total_amount">
                                            <span className="ml-auto">Amount</span>
                                        </SortHeader>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCases.map((c) => (
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

            {/* Evidence Drawer */}
            <EvidenceDrawer
                violationId={selectedViolationId}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
            />
        </div>
    );
}
