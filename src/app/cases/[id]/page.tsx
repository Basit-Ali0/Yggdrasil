'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
    Loader2, AlertTriangle, Shield, FileText, Send, Download,
    CheckCircle, XCircle, Clock, User, DollarSign,
} from 'lucide-react';

interface CaseViolation {
    id: string;
    rule_id: string;
    rule_name: string;
    severity: string;
    account: string;
    amount: number;
    status: string;
    explanation: string;
}

interface CaseTimelineEvent {
    id: string;
    event_type: string;
    actor_id: string | null;
    payload: Record<string, string>;
    created_at: string;
}

interface PriorCase {
    id: string;
    scan_id: string;
    status: string;
    severity_rollup: string;
    violation_count: number;
    suspicious_amount: number;
    created_at: string;
}

interface CaseDetail {
    id: string;
    subject_key: string;
    subject_type: string;
    status: string;
    disposition: string | null;
    narrative: string | null;
    severity_rollup: string;
    violation_count: number;
    open_violations: number;
    suspicious_amount: number;
    counterparty_count: number;
    priority_score: number;
    owner_id: string | null;
    created_at: string;
    updated_at: string;
    violations: CaseViolation[];
    timeline: CaseTimelineEvent[];
    prior_cases: PriorCase[];
    grouped_evidence: Array<{ rule_id: string; rule_name: string; count: number; total_amount: number }>;
    review_summary: { total: number; pending: number; approved: number; false_positive: number };
    sar_ready: boolean;
    sar_analyst_summary: string | null;
}

const STATUS_OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'in_review', label: 'In Review' },
    { value: 'escalated', label: 'Escalated' },
    { value: 'closed_no_action', label: 'Closed (No Action)' },
    { value: 'sar_prepared', label: 'SAR Prepared' },
];

const DISPOSITION_OPTIONS = [
    { value: 'false_positive', label: 'False Positive' },
    { value: 'monitor', label: 'Monitor' },
    { value: 'investigate_further', label: 'Investigate Further' },
    { value: 'prepare_sar', label: 'Prepare SAR' },
    { value: 'closed', label: 'Closed' },
];

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [caseData, setCaseData] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [noteText, setNoteText] = useState('');
    const [saving, setSaving] = useState(false);

    const loadCase = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get<CaseDetail>(`/cases/${id}`);
            setCaseData(data);
        } catch {
            toast.error('Failed to load case');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadCase();
    }, [loadCase]);

    async function updateCase(updates: Record<string, unknown>) {
        setSaving(true);
        try {
            await api.patch(`/cases/${id}`, updates);
            toast.success('Case updated');
            loadCase();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setSaving(false);
        }
    }

    async function addNote() {
        if (!noteText.trim()) return;
        setSaving(true);
        try {
            await api.post(`/cases/${id}/notes`, { content: noteText.trim() });
            setNoteText('');
            toast.success('Note added');
            loadCase();
        } catch {
            toast.error('Failed to add note');
        } finally {
            setSaving(false);
        }
    }

    async function assignToMe() {
        setSaving(true);
        try {
            const { getSupabaseBrowser } = await import('@/lib/supabase-browser');
            const supabase = getSupabaseBrowser();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { toast.error('Not authenticated'); return; }
            await api.post(`/cases/${id}/assign`, { owner_id: user.id });
            toast.success('Case assigned to you');
            loadCase();
        } catch {
            toast.error('Failed to assign case');
        } finally {
            setSaving(false);
        }
    }

    if (loading || !caseData) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const c = caseData;
    const formatAmount = (n: number) =>
        n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    return (
        <div className="container mx-auto max-w-5xl py-8 px-4 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight font-mono">{c.subject_key}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Case {c.id.slice(0, 8)} &middot; {c.subject_type} &middot; Created {new Date(c.created_at).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!c.owner_id && (
                        <Button size="sm" variant="outline" onClick={assignToMe} disabled={saving}>
                            <User className="h-3.5 w-3.5 mr-1" /> Assign to Me
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/api/cases/${id}/export?format=json`, '_blank')}
                    >
                        <Download className="h-3.5 w-3.5 mr-1" /> Export JSON
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/api/cases/${id}/export?format=pdf`, '_blank')}
                    >
                        <FileText className="h-3.5 w-3.5 mr-1" /> Export PDF
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                        <div className="text-2xl font-bold">{c.violation_count}</div>
                        <div className="text-xs text-muted-foreground">Violations ({c.open_violations} open)</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <DollarSign className="h-5 w-5 mx-auto mb-1 text-red-500" />
                        <div className="text-2xl font-bold">{formatAmount(c.suspicious_amount)}</div>
                        <div className="text-xs text-muted-foreground">Suspicious Amount</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <Shield className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                        <div className="text-2xl font-bold">{c.severity_rollup}</div>
                        <div className="text-xs text-muted-foreground">Severity</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <FileText className="h-5 w-5 mx-auto mb-1 text-green-500" />
                        <div className="text-2xl font-bold">{c.priority_score.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Priority Score</div>
                    </CardContent>
                </Card>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <Select value={c.status} onValueChange={(v) => updateCase({ status: v })}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Disposition:</span>
                    <Select value={c.disposition ?? ''} onValueChange={(v) => updateCase({ disposition: v })}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="Set disposition" /></SelectTrigger>
                        <SelectContent>
                            {DISPOSITION_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {c.sar_ready && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" /> SAR Ready
                    </Badge>
                )}
            </div>

            {/* Rule families / grouped evidence (P3-25) */}
            {c.grouped_evidence.length > 0 && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Triggered Rule Families</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {c.grouped_evidence.map((g) => (
                                <div key={g.rule_id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                                    <span className="font-medium truncate">{g.rule_name}</span>
                                    <span className="text-muted-foreground whitespace-nowrap ml-2">
                                        {g.count}x &middot; {formatAmount(g.total_amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Prior subject history (P3-17) */}
            {c.prior_cases.length > 0 && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Prior Cases for This Subject</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            {c.prior_cases.map((pc) => (
                                <div key={pc.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                                    <span>{new Date(pc.created_at).toLocaleDateString()} &middot; {pc.status}</span>
                                    <span className="text-muted-foreground">{pc.violation_count} violations &middot; {pc.severity_rollup}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Violations */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        Linked Violations ({c.review_summary.total})
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {c.review_summary.approved} approved &middot; {c.review_summary.false_positive} FP &middot; {c.review_summary.pending} pending
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {c.violations.map((v) => (
                            <div key={v.id} className="flex items-start gap-3 rounded border px-3 py-2">
                                {v.status === 'pending' ? (
                                    <Clock className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                                ) : v.status === 'approved' ? (
                                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                                ) : (
                                    <XCircle className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">{v.rule_name}</span>
                                        <Badge variant="outline" className="text-xs">{v.severity}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.explanation}</p>
                                </div>
                                <span className="text-sm font-mono whitespace-nowrap">
                                    {formatAmount(Number(v.amount ?? 0))}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Narrative (P3-09) */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Investigation Narrative</CardTitle></CardHeader>
                <CardContent>
                    <Textarea
                        value={c.narrative ?? ''}
                        onChange={(e) => setCaseData({ ...c, narrative: e.target.value })}
                        placeholder="Write the investigation narrative for this case..."
                        className="min-h-[100px]"
                    />
                    <Button
                        size="sm" className="mt-2"
                        disabled={saving}
                        onClick={() => updateCase({ narrative: c.narrative })}
                    >
                        Save Narrative
                    </Button>
                </CardContent>
            </Card>

            {/* Add note */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Add Note</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add an analyst note..."
                            className="min-h-[60px]"
                        />
                        <Button size="sm" onClick={addNote} disabled={saving || !noteText.trim()} className="self-end">
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
                <CardContent>
                    {c.timeline.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No events yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {c.timeline.map((evt) => (
                                <div key={evt.id} className="flex items-start gap-3 text-sm border-b last:border-0 pb-2">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                                        {new Date(evt.created_at).toLocaleString()}
                                    </span>
                                    <div>
                                        <span className="font-medium">{evt.event_type.replace(/_/g, ' ')}</span>
                                        {evt.payload?.content && (
                                            <p className="text-muted-foreground mt-0.5">{evt.payload.content}</p>
                                        )}
                                        {evt.payload?.new_status && (
                                            <span className="text-muted-foreground"> &rarr; {evt.payload.new_status}</span>
                                        )}
                                        {evt.payload?.new_disposition && (
                                            <span className="text-muted-foreground"> &rarr; {evt.payload.new_disposition}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
