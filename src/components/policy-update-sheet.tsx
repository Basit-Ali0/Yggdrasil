'use client';

import { useEffect, useRef } from 'react';
import { usePolicyStore } from '@/stores/policy-store';
import { SeverityBadge } from '@/components/ui-custom/severity-badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    Trash2,
    Loader2,
    FileText,
    Shield,
    Scale,
    Lock,
    Upload,
} from 'lucide-react';

interface PolicyUpdateSheetProps {
    policyId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const policyCards = [
    {
        type: 'aml',
        label: 'AML',
        description: 'Anti-Money Laundering rules',
        icon: Shield,
    },
    {
        type: 'gdpr',
        label: 'GDPR',
        description: 'Data protection rules',
        icon: Lock,
    },
    {
        type: 'soc2',
        label: 'SOC 2',
        description: 'Security & compliance rules',
        icon: Scale,
    },
];

export function PolicyUpdateSheet({ policyId, open, onOpenChange }: PolicyUpdateSheetProps) {
    const {
        policy,
        isLoading,
        isUpdating,
        fetchPolicy,
        toggleRule,
        deleteRule,
        addPrebuiltRules,
        addPdfRules,
    } = usePolicyStore();

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (policyId && open) {
            fetchPolicy(policyId);
        }
    }, [policyId, open, fetchPolicy]);

    const activeRuleCount = policy?.rules.filter((r) => r.is_active).length ?? 0;

    const handleToggle = async (ruleId: string, checked: boolean) => {
        await toggleRule(policyId, ruleId, checked);
    };

    const handleDelete = async (ruleId: string) => {
        await deleteRule(policyId, ruleId);
        toast.success('Rule removed');
    };

    const handleAddPrebuilt = async (policyType: string) => {
        await addPrebuiltRules(policyId, policyType);
        toast.success('Prebuilt rules added', {
            description: `Added ${policyType.toUpperCase()} rules to the policy.`,
        });
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        await addPdfRules(policyId, file);
        toast.success('PDF rules extracted', {
            description: `Rules extracted and added from ${file.name}.`,
        });

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-lg p-0 overflow-hidden">
                {isLoading || !policy ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <div className="flex h-full flex-col overflow-hidden">
                        {/* Header */}
                        <SheetHeader className="border-b px-6 py-4 shrink-0">
                            <SheetTitle className="text-lg">Update Policies</SheetTitle>
                            <SheetDescription className="flex items-center gap-2">
                                {policy.name}
                                <Badge variant="outline" className="text-xs">
                                    {policy.type.toUpperCase()}
                                </Badge>
                            </SheetDescription>
                        </SheetHeader>

                        {/* Body */}
                        <ScrollArea className="flex-1">
                            <div className="px-6 py-4 space-y-6">
                                {/* Section 1: Active Rules */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-medium">Active Rules</h3>
                                        <Badge variant="secondary" className="text-xs">
                                            {activeRuleCount} of {policy.rules.length} active
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        {policy.rules.map((rule) => (
                                            <div
                                                key={rule.rule_id}
                                                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                                            >
                                                <Switch
                                                    size="sm"
                                                    checked={rule.is_active}
                                                    onCheckedChange={(checked) =>
                                                        handleToggle(rule.rule_id, checked)
                                                    }
                                                    disabled={isUpdating}
                                                />

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {rule.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="font-mono text-[10px] text-muted-foreground">
                                                            {rule.rule_id}
                                                        </span>
                                                        <SeverityBadge severity={rule.severity} />
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDelete(rule.rule_id)}
                                                    disabled={isUpdating}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ))}

                                        {policy.rules.length === 0 && (
                                            <p className="py-6 text-center text-sm text-muted-foreground">
                                                No rules configured. Add rules below.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <Separator />

                                {/* Section 2: Add Rules */}
                                <div>
                                    <h3 className="text-sm font-medium mb-3">Add Rules</h3>

                                    <Tabs defaultValue="prebuilt">
                                        <TabsList className="w-full">
                                            <TabsTrigger value="prebuilt" className="flex-1">
                                                Prebuilt
                                            </TabsTrigger>
                                            <TabsTrigger value="pdf" className="flex-1">
                                                PDF Upload
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="prebuilt" className="mt-3">
                                            <div className="grid gap-2">
                                                {policyCards.map((card) => {
                                                    const Icon = card.icon;
                                                    return (
                                                        <Card
                                                            key={card.type}
                                                            className="cursor-pointer transition-colors hover:bg-muted/50"
                                                            onClick={() =>
                                                                !isUpdating &&
                                                                handleAddPrebuilt(card.type)
                                                            }
                                                        >
                                                            <CardContent className="flex items-center gap-3 p-3">
                                                                {isUpdating ? (
                                                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                                                                ) : (
                                                                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                                                                )}
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium">
                                                                        {card.label}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {card.description}
                                                                    </p>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="pdf" className="mt-3">
                                            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6">
                                                <FileText className="h-8 w-8 text-muted-foreground" />
                                                <p className="text-sm text-muted-foreground text-center">
                                                    Upload a PDF policy document to extract rules automatically.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={isUpdating}
                                                >
                                                    {isUpdating ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Upload className="mr-2 h-4 w-4" />
                                                    )}
                                                    Select PDF
                                                </Button>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".pdf"
                                                    className="hidden"
                                                    onChange={handlePdfUpload}
                                                />
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
