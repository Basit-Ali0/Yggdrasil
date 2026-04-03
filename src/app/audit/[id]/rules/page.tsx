'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuditStore } from '@/stores/audit-store';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowRight, BookOpen, ShieldAlert } from 'lucide-react';

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
                    Toggle rules on or off before running the scan. All rules are enabled by
                    default.{' '}
                    {rules.some((r) => r.validation_status === 'invalid') && (
                        <span className="text-amber-600 dark:text-amber-400">
                            Some rules have validation issues and cannot be executed — they are
                            disabled automatically.
                        </span>
                    )}
                </p>
            </div>

            {/* Rules List */}
            <TooltipProvider>
                <div className="space-y-3 children-stagger">
                    {rules.map((rule) => {
                        const isInvalid = rule.validation_status === 'invalid';
                        const firstIssue =
                            Array.isArray(rule.validation_issues) &&
                            rule.validation_issues.length > 0
                                ? (rule.validation_issues[0] as { message?: string })?.message
                                : null;

                        return (
                            <Card
                                key={rule.rule_id}
                                className={`transition-opacity ${
                                    !rule.is_active ? 'opacity-50' : ''
                                } ${isInvalid ? 'border-amber-300 dark:border-amber-700' : ''}`}
                            >
                                <CardContent className="flex items-center gap-4 p-4">
                                    <Switch
                                        checked={rule.is_active && !isInvalid}
                                        onCheckedChange={() =>
                                            !isInvalid && void toggleRule(rule.rule_id)
                                        }
                                        disabled={isInvalid}
                                        aria-label={`Toggle ${rule.name}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono-code text-xs text-muted-foreground">
                                                {rule.rule_id}
                                            </span>
                                            <SeverityBadge severity={rule.severity} />
                                            {isInvalid && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 cursor-help">
                                                            <ShieldAlert className="h-3 w-3" />
                                                            Invalid
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs">
                                                        <p className="text-xs">
                                                            {firstIssue ||
                                                                'This rule could not be validated for execution and has been disabled.'}
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm font-medium">{rule.name}</p>
                                        {rule.description && (
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                {rule.description}
                                            </p>
                                        )}
                                        {isInvalid && firstIssue && (
                                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                                {firstIssue}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </TooltipProvider>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 flex items-center justify-between border-t bg-background py-4">
                <p className="text-sm text-muted-foreground">
                    <strong>{activeRules.length}</strong> of {rules.length} rules selected
                    {rules.some((r) => r.validation_status === 'invalid') && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                            ({rules.filter((r) => r.validation_status === 'invalid').length}{' '}
                            invalid)
                        </span>
                    )}
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
