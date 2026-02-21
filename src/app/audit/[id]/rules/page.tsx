'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, BookOpen } from 'lucide-react';

export default function RulesListPage() {
    const router = useRouter();
    const params = useParams();
    const { rules, toggleRule } = useAuditStore();

    const activeRules = rules.filter((r) => r.is_active);

    if (rules.length === 0) {
        return (
            <EmptyState
                icon={BookOpen}
                title="No rules loaded"
                description="Please go back and select a policy framework."
                action={{
                    label: 'Back to New Audit',
                    onClick: () => router.push('/audit/new'),
                }}
            />
        );
    }

    return (
        <div className="animate-fade-in-up space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Review Rules</h1>
                <p className="mt-1 text-muted-foreground">
                    Toggle rules on or off before running the scan. All rules are enabled by default.
                </p>
            </div>

            {/* Rules List */}
            <div className="space-y-3 children-stagger">
                {rules.map((rule) => (
                    <Card
                        key={rule.rule_id}
                        className={`transition-opacity ${!rule.is_active ? 'opacity-50' : ''}`}
                    >
                        <CardContent className="flex items-center gap-4 p-4">
                            <Switch
                                checked={rule.is_active}
                                onCheckedChange={() => toggleRule(rule.rule_id)}
                                aria-label={`Toggle ${rule.name}`}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono-code text-xs text-muted-foreground">
                                        {rule.rule_id}
                                    </span>
                                    <SeverityBadge severity={rule.severity} />
                                </div>
                                <p className="mt-1 text-sm font-medium">{rule.name}</p>
                                {rule.description && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {rule.description}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 flex items-center justify-between border-t bg-background py-4">
                <p className="text-sm text-muted-foreground">
                    <strong>{activeRules.length}</strong> of {rules.length} rules selected
                </p>
                <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => router.push(`/audit/${params.id}/mapping`)}
                    disabled={activeRules.length === 0}
                >
                    Continue to Mapping
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
