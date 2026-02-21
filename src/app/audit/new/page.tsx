'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Shield, AlertCircle, Star } from 'lucide-react';

const POLICY_OPTIONS = [
    {
        type: 'aml' as const,
        name: 'AML Compliance',
        description: 'Anti-Money Laundering — CTR Threshold, Structuring Detection, SAR Triggers, Velocity Monitoring',
        rules: 10,
        recommended: true,
    },
    {
        type: 'gdpr' as const,
        name: 'GDPR',
        description: 'Data Retention, Consent, PII Protection, Encryption',
        rules: 10,
        recommended: false,
    },
    {
        type: 'soc2' as const,
        name: 'SOC2',
        description: 'Access Control, Encryption, Audit Logging, Availability',
        rules: 12,
        recommended: false,
    },
];

export default function NewAuditPage() {
    const router = useRouter();
    const { createAudit, isCreating, error, clearError } = useAuditStore();
    const [name, setName] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState<'aml' | 'gdpr' | 'soc2' | null>(null);

    const canStart = name.trim().length > 0 && selectedPolicy !== null;

    const handleStart = async () => {
        if (!canStart || !selectedPolicy) return;
        await createAudit({ name: name.trim(), policy_type: selectedPolicy });

        const currentError = useAuditStore.getState().error;
        if (!currentError) {
            const auditId = useAuditStore.getState().auditId;
            toast.success('Audit created', { description: `"${name.trim()}" is ready for data upload.` });
            router.push(`/audit/${auditId}/upload`);
        } else {
            toast.error('Failed to create audit', { description: currentError });
        }
    };

    return (
        <div className="animate-fade-in-up space-y-8">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Start New Audit</h1>
                <p className="mt-1 text-muted-foreground">
                    Name your audit and select a compliance framework.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Audit Name */}
            <div className="max-w-md space-y-2">
                <Label htmlFor="audit-name">Audit Name</Label>
                <Input
                    id="audit-name"
                    placeholder="e.g. Q1 AML Review"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        clearError();
                    }}
                    autoFocus
                />
            </div>

            {/* Policy Selection */}
            <div className="space-y-3">
                <Label>Select Policy Framework</Label>
                <div className="grid gap-4 sm:grid-cols-3">
                    {POLICY_OPTIONS.map((policy) => (
                        <Card
                            key={policy.type}
                            className={`cursor-pointer transition-all
                                ${selectedPolicy === policy.type
                                    ? 'border-primary ring-2 ring-primary/20'
                                    : 'hover:border-primary/50'}
                            `}
                            onClick={() => {
                                setSelectedPolicy(policy.type);
                                clearError();
                            }}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <Shield className="h-5 w-5 text-primary" />
                                    </div>
                                    {policy.recommended && (
                                        <Badge variant="secondary" className="gap-1 text-xs">
                                            <Star className="h-3 w-3" />
                                            Recommended
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="mt-3 text-lg">{policy.name}</CardTitle>
                                <CardDescription className="text-xs">
                                    {policy.rules} rules
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    {policy.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Start Button */}
            <div className="flex items-center gap-4 border-t pt-6">
                <Button
                    size="lg"
                    disabled={!canStart || isCreating}
                    onClick={handleStart}
                >
                    {isCreating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating audit...
                        </>
                    ) : (
                        'Start Audit'
                    )}
                </Button>
                {!canStart && (
                    <p className="text-sm text-muted-foreground">
                        Enter an audit name and select a policy to continue
                    </p>
                )}
            </div>
        </div>
    );
}
