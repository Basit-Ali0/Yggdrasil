'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { PolicyExtractResponse, PolicyListItem, PolicyListResponse } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui-custom/empty-state';
import { ErrorState } from '@/components/ui-custom/error-state';
import { BookOpen, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PoliciesPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [policies, setPolicies] = useState<PolicyListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const data = await api.get<PolicyListResponse>('/policies');
            setPolicies(data.policies);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load policies');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function uploadPdf(file: File) {
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const data = await api.upload<PolicyExtractResponse>('/policies/ingest', form);
            toast.success('Policy created', { description: `${data.policy.rules.length} rules extracted.` });
            router.push(`/policies/${data.policy.id}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Policy upload failed');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    const filtered = policies.filter((policy) => policy.name.toLowerCase().includes(query.toLowerCase()));

    if (error) return <ErrorState message={error} onRetry={load} />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
                    <p className="mt-1 text-muted-foreground">Manage rule packs, custom PDF policies, and policy validation state.</p>
                </div>
                <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
                    <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Create from PDF
                    </Button>
                    <Button onClick={() => router.push('/audit/new')}>New Audit</Button>
                </div>
            </div>

            <Input className="max-w-sm" placeholder="Search policies..." value={query} onChange={(e) => setQuery(e.target.value)} />

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading policies...</div>
            ) : filtered.length === 0 ? (
                <EmptyState icon={BookOpen} title="No policies found" description="Create an audit or upload a custom PDF policy." />
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((policy) => (
                        <Link key={policy.id} href={`/policies/${policy.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <Card className="h-full transition-colors hover:bg-muted/40">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <CardTitle className="text-base">{policy.name}</CardTitle>
                                        <Badge variant={policy.invalid_rule_count > 0 ? 'secondary' : 'outline'}>
                                            {policy.validation_status === 'valid' ? 'Valid' : `${policy.invalid_rule_count} invalid`}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm text-muted-foreground">
                                    <p>{policy.active_rule_count} active of {policy.rules_count} rules</p>
                                    <p>{policy.prebuilt_type?.toUpperCase() ?? policy.type}</p>
                                    <p>Updated {new Date(policy.updated_at).toLocaleDateString()}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
