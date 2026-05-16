'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useOrgStore } from '@/stores/org-store';
import type {
    CreateInvitationResponse,
    OrganizationEvent,
    OrganizationEventsResponse,
    OrganizationInvitation,
    OrganizationInvitationsResponse,
    OrganizationMember,
    OrganizationMembersResponse,
    OrganizationRole,
} from '@/lib/contracts';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ErrorState } from '@/components/ui-custom/error-state';
import { Building2, Clipboard, Crown, Loader2, LogOut, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OrganizationPage() {
    const router = useRouter();
    const { currentOrg, role, fetchCurrentOrg } = useOrgStore();
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
    const [events, setEvents] = useState<OrganizationEvent[]>([]);
    const [orgName, setOrgName] = useState('');
    const [orgSlug, setOrgSlug] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<OrganizationRole>('member');
    const [lastInviteUrl, setLastInviteUrl] = useState('');
    const [transferMemberId, setTransferMemberId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canEdit = role === 'owner' || role === 'admin';
    const isOwner = role === 'owner';
    const currentMember = members.find((member) => member.is_current_user);
    const assignableRoles: OrganizationRole[] = isOwner ? ['owner', 'admin', 'member'] : ['member'];

    const ownerTransferTargets = useMemo(
        () => members.filter((member) => !member.is_current_user),
        [members],
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await fetchCurrentOrg();
            const [memberData, inviteData, eventData] = await Promise.all([
                api.get<OrganizationMembersResponse>('/organizations/members'),
                canEdit
                    ? api.get<OrganizationInvitationsResponse>('/organizations/invitations')
                    : Promise.resolve({ invitations: [] }),
                api.get<OrganizationEventsResponse>('/organizations/events'),
            ]);
            setMembers(memberData.members);
            setInvitations(inviteData.invitations);
            setEvents(eventData.events);
            const org = useOrgStore.getState().currentOrg;
            setOrgName(org?.name ?? '');
            setOrgSlug(org?.slug ?? '');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load organization');
        } finally {
            setLoading(false);
        }
    }, [canEdit, fetchCurrentOrg]);

    useEffect(() => {
        load();
    }, [load]);

    async function updateOrg() {
        setSaving(true);
        try {
            await api.patch('/organizations/current', { name: orgName, slug: orgSlug });
            await fetchCurrentOrg();
            toast.success('Organization updated');
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setSaving(false);
        }
    }

    async function createInvite() {
        setSaving(true);
        try {
            const data = await api.post<CreateInvitationResponse>('/organizations/invitations', {
                email: inviteEmail,
                role: inviteRole,
            });
            setInviteEmail('');
            setInviteRole('member');
            setLastInviteUrl(data.invite_url);
            await navigator.clipboard?.writeText(data.invite_url).catch(() => undefined);
            toast.success('Invite created', { description: 'Invite link copied when clipboard access is available.' });
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Invite failed');
        } finally {
            setSaving(false);
        }
    }

    async function revokeInvite(invitationId: string) {
        await api.delete(`/organizations/invitations/${invitationId}`);
        toast.success('Invite revoked');
        await load();
    }

    async function updateMember(memberId: string, memberRole: OrganizationRole) {
        await api.patch(`/organizations/members/${memberId}`, { role: memberRole });
        toast.success('Role updated');
        await load();
    }

    async function removeMember(member: OrganizationMember) {
        await api.delete(`/organizations/members/${member.id}`);
        toast.success(member.is_current_user ? 'You left the organization' : 'Member removed');
        if (member.is_current_user) {
            await fetchCurrentOrg();
            router.push('/audit/new');
        } else {
            await load();
        }
    }

    async function transferOwnership() {
        if (!transferMemberId) return;
        setSaving(true);
        try {
            await api.post('/organizations/transfer-ownership', { target_member_id: transferMemberId });
            toast.success('Ownership transferred');
            setTransferMemberId('');
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Transfer failed');
        } finally {
            setSaving(false);
        }
    }

    if (error) return <AppShell><ErrorState message={error} onRetry={load} /></AppShell>;

    return (
        <AppShell maxWidth="max-w-7xl">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
                        <p className="mt-1 text-muted-foreground">Workspace profile, access, invites, ownership, and event history.</p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/organization/new')}>Create Organization</Button>
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading organization...</div>
                ) : (
                    <>
                        <Card className="overflow-hidden">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Workspace Profile</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canEdit} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Slug</Label>
                                    <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} disabled={!canEdit} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{role ?? 'member'}</Badge>
                                    <span className="text-sm text-muted-foreground">
                                        Created {currentOrg ? new Date(currentOrg.created_at).toLocaleDateString() : 'unknown'}
                                    </span>
                                </div>
                                {canEdit && (
                                    <div className="flex justify-end">
                                        <Button onClick={updateOrg} disabled={saving || !orgName.trim()}>Save Workspace</Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-base">Members</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {members.map((member) => (
                                            <TableRow key={member.id}>
                                                <TableCell>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span>{member.email ?? member.user_id}</span>
                                                        {member.is_current_user && <Badge variant="outline">You</Badge>}
                                                        {member.is_last_owner && <Badge variant="secondary">Last owner</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {member.can_change_role ? (
                                                        <Select value={member.role} onValueChange={(value: OrganizationRole) => updateMember(member.id, value)}>
                                                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {assignableRoles.map((option) => (
                                                                    <SelectItem key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Badge variant="outline">{member.role}</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    {member.can_remove && (
                                                        <Button variant="ghost" size="icon" onClick={() => removeMember(member)}>
                                                            {member.is_current_user ? <LogOut className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4" /> Invitations</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    {canEdit && (
                                        <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
                                            <div className="space-y-2">
                                                <Label>Email</Label>
                                                <Input className="w-72" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com" />
                                            </div>
                                            <Select value={inviteRole} onValueChange={(value: OrganizationRole) => setInviteRole(value)}>
                                                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {assignableRoles.map((option) => (
                                                        <SelectItem key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button onClick={createInvite} disabled={saving || !inviteEmail.trim()}>Create Invite</Button>
                                        </div>
                                    )}
                                    {lastInviteUrl && (
                                        <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
                                            <span className="min-w-0 flex-1 truncate">{lastInviteUrl}</span>
                                            <Button variant="ghost" size="icon" onClick={() => navigator.clipboard?.writeText(lastInviteUrl)}>
                                                <Clipboard className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {invitations.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No invitations yet.</p>
                                        ) : invitations.map((invite) => (
                                            <div key={invite.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                                                <div>
                                                    <p className="font-medium">{invite.email}</p>
                                                    <p className="text-xs text-muted-foreground">{invite.role} · {invite.status} · expires {new Date(invite.expires_at).toLocaleDateString()}</p>
                                                </div>
                                                {canEdit && invite.status === 'pending' && (
                                                    <Button variant="ghost" size="sm" onClick={() => revokeInvite(invite.id)}>Revoke</Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Crown className="h-4 w-4" /> Ownership & Danger Zone</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    {isOwner ? (
                                        <div className="space-y-3 rounded-lg border p-3">
                                            <Label>Transfer ownership</Label>
                                            <div className="flex flex-wrap gap-2">
                                                <Select value={transferMemberId || undefined} onValueChange={setTransferMemberId}>
                                                    <SelectTrigger className="w-72"><SelectValue placeholder="Select member" /></SelectTrigger>
                                                    <SelectContent>
                                                        {ownerTransferTargets.map((member) => (
                                                            <SelectItem key={member.id} value={member.id}>{member.email ?? member.user_id}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="outline" disabled={saving || !transferMemberId} onClick={transferOwnership}>Promote to owner</Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">You remain an owner unless your role is changed later.</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Only owners can transfer ownership.</p>
                                    )}
                                    <Separator />
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Leave organization</p>
                                        <p className="text-sm text-muted-foreground">You can leave if you are not the last owner.</p>
                                        <Button
                                            variant="outline"
                                            disabled={!currentMember?.can_remove}
                                            onClick={() => currentMember && removeMember(currentMember)}
                                        >
                                            Leave workspace
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader><CardTitle className="text-base">Event History</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {events.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No organization events yet.</p>
                                ) : events.map((event) => (
                                    <div key={event.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-medium">{event.event_type.replace(/\./g, ' ')}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {event.actor_email ?? 'System'} {event.target_email ? `→ ${event.target_email}` : ''}
                                            </p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AppShell>
    );
}
