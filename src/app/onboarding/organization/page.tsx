'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { useOrgStore } from '@/stores/org-store';
import { api } from '@/lib/api';
import type { AcceptInvitationResponse } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function tokenFromInput(value: string): string {
    const trimmed = value.trim();
    try {
        return new URL(trimmed).searchParams.get('token') ?? trimmed;
    } catch {
        return trimmed;
    }
}

export default function OrganizationOnboardingPage() {
    const router = useRouter();
    const { createOrg, fetchCurrentOrg } = useOrgStore();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [invite, setInvite] = useState('');
    const [busy, setBusy] = useState<'create' | 'join' | null>(null);

    async function createWorkspace() {
        setBusy('create');
        try {
            await createOrg({ name, slug: slug || undefined });
            toast.success('Workspace created');
            router.push('/audit/new');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create workspace');
        } finally {
            setBusy(null);
        }
    }

    async function joinWorkspace() {
        setBusy('join');
        try {
            const token = tokenFromInput(invite);
            const data = await api.post<AcceptInvitationResponse>('/organizations/invitations/accept', { token });
            await fetchCurrentOrg();
            await useOrgStore.getState().switchOrg(data.organization.id);
            toast.success('Workspace joined');
            router.push('/audit/new');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to accept invite');
        } finally {
            setBusy(null);
        }
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.45))] px-4 py-10">
            <div className="mx-auto max-w-5xl space-y-8">
                <div className="max-w-2xl">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-sm text-muted-foreground shadow-sm">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Workspace setup
                    </div>
                    <h1 className="font-display text-4xl font-bold tracking-tight">Create or join your compliance workspace.</h1>
                    <p className="mt-3 text-muted-foreground">
                        Yggdrasil keeps audits, connectors, cases, and exports scoped to an organization. Start a new workspace or join one with an invite link.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-primary/20 bg-background/85 shadow-xl shadow-primary/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" /> Create workspace
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Workspace name</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Northstar Compliance" />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug optional</Label>
                                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="northstar-compliance" />
                            </div>
                            <Button className="w-full" disabled={busy !== null || !name.trim()} onClick={createWorkspace}>
                                {busy === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create and continue
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-background/85 shadow-xl shadow-black/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Link2 className="h-5 w-5 text-primary" /> Join with invite
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Invite link or token</Label>
                                <Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Paste invite link" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                The email on your signed-in account must match the invitation.
                            </p>
                            <Button variant="outline" className="w-full" disabled={busy !== null || !invite.trim()} onClick={joinWorkspace}>
                                {busy === 'join' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Accept invite
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
