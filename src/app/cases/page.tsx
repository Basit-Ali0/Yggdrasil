'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle, Shield, User, DollarSign } from 'lucide-react';

interface CaseSummary {
    id: string;
    subject_key: string;
    subject_type: string;
    status: string;
    disposition: string | null;
    severity_rollup: string;
    violation_count: number;
    open_violations: number;
    suspicious_amount: number;
    priority_score: number;
    owner_id: string | null;
    latest_activity: string;
    created_at: string;
    scan_id: string;
}

const STATUS_COLORS: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    in_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    escalated: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    closed_no_action: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    sar_prepared: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: 'text-red-600 dark:text-red-400',
    HIGH: 'text-orange-600 dark:text-orange-400',
    MEDIUM: 'text-yellow-600 dark:text-yellow-400',
};

export default function CaseQueuePage() {
    const router = useRouter();
    const [cases, setCases] = useState<CaseSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const loadCases = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            params.set('limit', '100');
            const data = await api.get<{ cases: CaseSummary[]; total: number }>(
                `/cases?${params.toString()}`
            );
            setCases(data.cases);
            setTotal(data.total);
        } catch {
            setCases([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadCases();
    }, [loadCases]);

    const formatAmount = (n: number) =>
        n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    return (
        <div className="container mx-auto max-w-6xl py-8 px-4">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">AML Case Queue</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {total} case{total !== 1 ? 's' : ''} across scans
                    </p>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                        <SelectItem value="closed_no_action">Closed</SelectItem>
                        <SelectItem value="sar_prepared">SAR Prepared</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : cases.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Shield className="mx-auto h-10 w-10 mb-3 opacity-40" />
                        <p>No cases found. Run an AML scan to auto-generate cases.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {cases.map((c) => (
                        <Card
                            key={c.id}
                            className="cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => router.push(`/cases/${c.id}`)}
                        >
                            <CardContent className="flex items-center gap-4 py-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm font-semibold truncate">
                                            {c.subject_key}
                                        </span>
                                        <Badge variant="outline" className={STATUS_COLORS[c.status] ?? ''}>
                                            {c.status.replace(/_/g, ' ')}
                                        </Badge>
                                        <span className={`text-xs font-medium ${SEVERITY_COLORS[c.severity_rollup] ?? ''}`}>
                                            {c.severity_rollup}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            {c.violation_count} violation{c.violation_count !== 1 ? 's' : ''}
                                            {c.open_violations > 0 && ` (${c.open_violations} open)`}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <DollarSign className="h-3 w-3" />
                                            {formatAmount(c.suspicious_amount)}
                                        </span>
                                        {c.owner_id && (
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                Assigned
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                    <div>Score: {c.priority_score.toFixed(1)}</div>
                                    <div>{new Date(c.latest_activity).toLocaleDateString()}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
