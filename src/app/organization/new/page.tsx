'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';
import { useOrgStore } from '@/stores/org-store';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewOrganizationPage() {
    const router = useRouter();
    const { createOrg } = useOrgStore();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit() {
        setBusy(true);
        try {
            await createOrg({ name, slug: slug || undefined });
            toast.success('Organization created');
            router.push('/audit/new');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create organization');
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppShell>
            <div className="mx-auto max-w-2xl space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Create Organization</h1>
                    <p className="mt-1 text-muted-foreground">Spin up a separate workspace for another team, client, or regulatory program.</p>
                </div>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Workspace profile</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Risk Operations" />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug optional</Label>
                            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-risk" />
                        </div>
                        <Button onClick={submit} disabled={busy || !name.trim()}>
                            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create organization
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    );
}
