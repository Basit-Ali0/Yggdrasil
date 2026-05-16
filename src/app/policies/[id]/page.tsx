'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePolicyStore } from '@/stores/policy-store';
import type { CreateAuditResponse } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import { ErrorState } from '@/components/ui-custom/error-state';
import { FileText, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const { policy, isLoading, isUpdating, error, fetchPolicy, toggleRule, deleteRule, addPrebuiltRules, addPdfRules } = usePolicyStore();
    const [auditName, setAuditName] = useState('');
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        fetchPolicy(id);
    }, [id, fetchPolicy]);

    async function startAudit() {
        if (!policy) return;
        setStarting(true);
        try {
            const data = await api.post<CreateAuditResponse>('/audits', {
                name: auditName.trim() || `${policy.name} Audit`,
                policy_id: policy.id,
            });
            router.push(`/audit/${data.audit_id}/upload`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to start audit');
        } finally {
            setStarting(false);
        }
    }

    async function uploadPdf(file: File) {
        await addPdfRules(id, file);
        toast.success('PDF rules added');
        if (fileRef.current) fileRef.current.value = '';
    }

    if (error) return <ErrorState message={error} onRetry={() => fetchPolicy(id)} />;
    if (isLoading || !policy) {
        return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading policy...</div>;
    }

    const invalidCount = policy.rules.filter((rule) => rule.validation_status === 'invalid').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{policy.name}</h1>
                    <p className="mt-1 text-muted-foreground">{policy.rules.length} rules · {invalidCount} invalid</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => addPrebuiltRules(id, 'aml')} disabled={isUpdating}>Add AML</Button>
                    <Button variant="outline" onClick={() => addPrebuiltRules(id, 'gdpr')} disabled={isUpdating}>Add GDPR</Button>
                    <Button variant="outline" onClick={() => addPrebuiltRules(id, 'soc2')} disabled={isUpdating}>Add SOC2</Button>
                    <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
                    <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={isUpdating}><FileText className="mr-2 h-4 w-4" /> Add PDF</Button>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-base">Start Audit With This Policy</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-end gap-2">
                    <div className="space-y-2">
                        <Label>Audit name</Label>
                        <Input className="w-80" value={auditName} onChange={(e) => setAuditName(e.target.value)} placeholder={`${policy.name} Audit`} />
                    </div>
                    <Button onClick={startAudit} disabled={starting}>{starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Start Audit</Button>
                </CardContent>
            </Card>

            <div className="grid gap-3">
                {policy.rules.map((rule) => {
                    const invalid = rule.validation_status === 'invalid';
                    return (
                        <Card key={rule.rule_id} className={invalid ? 'border-amber-300' : ''}>
                            <CardContent className="flex items-start gap-4 p-4">
                                <Switch
                                    checked={rule.is_active && !invalid}
                                    disabled={invalid || isUpdating}
                                    onCheckedChange={(checked) => toggleRule(id, rule.rule_id, checked)}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono-code text-xs text-muted-foreground">{rule.rule_id}</span>
                                        <SeverityBadge severity={rule.severity} />
                                        {invalid && <Badge variant="secondary">Invalid</Badge>}
                                    </div>
                                    <p className="mt-1 font-medium">{rule.name}</p>
                                    {Array.isArray(rule.validation_issues) && rule.validation_issues[0]?.message && (
                                        <p className="mt-1 text-xs text-amber-600">{rule.validation_issues[0].message}</p>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteRule(id, rule.rule_id)}
                                    disabled={isUpdating}
                                    aria-label={`Delete rule ${rule.rule_id}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
