'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2, LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useOrgStore } from '@/stores/org-store';
import type { AcceptInvitationResponse, InvitationPreviewResponse } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AcceptInvitePage() {
    const router = useRouter();
    const params = useSearchParams();
    const token = params.get('token') ?? '';
    const { user, isAuthenticated, signOut } = useAuthStore();
    const { fetchCurrentOrg, switchOrg } = useOrgStore();
    const [preview, setPreview] = useState<InvitationPreviewResponse['invitation']>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);

    const emailMatches = useMemo(
        () => preview?.email?.toLowerCase() === user?.email?.toLowerCase(),
        [preview?.email, user?.email],
    );

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        api.get<InvitationPreviewResponse>(`/organizations/invitations/resolve?token=${encodeURIComponent(token)}`)
            .then((data) => setPreview(data.invitation))
            .catch(() => toast.error('Failed to load invitation'))
            .finally(() => setLoading(false));
    }, [token]);

    async function accept() {
        setAccepting(true);
        try {
            const data = await api.post<AcceptInvitationResponse>('/organizations/invitations/accept', { token });
            await fetchCurrentOrg();
            await switchOrg(data.organization.id);
            toast.success('Invitation accepted');
            router.push('/audit/new');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to accept invitation');
        } finally {
            setAccepting(false);
        }
    }

    const invalid = !preview || preview.status !== 'pending' || new Date(preview.expires_at) <= new Date();

    return (
        <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.16),transparent_38%),hsl(var(--background))] px-4 py-10">
            <Card className="w-full max-w-xl shadow-2xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {invalid ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-primary" />}
                        Organization invitation
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading invite...
                        </div>
                    ) : invalid ? (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">This invite is missing, expired, accepted, or revoked.</p>
                            <Button variant="outline" onClick={() => router.push('/')}>Back to Yggdrasil</Button>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border bg-muted/30 p-4">
                                <p className="text-sm text-muted-foreground">You were invited to</p>
                                <p className="mt-1 text-xl font-semibold">{preview.organization_name}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline">{preview.role}</Badge>
                                    <Badge variant="secondary">{preview.email}</Badge>
                                </div>
                            </div>

                            {!isAuthenticated() ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">Sign in or create an account with {preview.email} to accept this invitation.</p>
                                    <Button onClick={() => router.push(`/login?next=/invite/accept?token=${encodeURIComponent(token)}`)}>
                                        <LogIn className="mr-2 h-4 w-4" /> Sign in
                                    </Button>
                                </div>
                            ) : !emailMatches ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-destructive">
                                        You are signed in as {user?.email}, but this invite is for {preview.email}.
                                    </p>
                                    <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
                                </div>
                            ) : (
                                <Button onClick={accept} disabled={accepting}>
                                    {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Accept invitation
                                </Button>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
