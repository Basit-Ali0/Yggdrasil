import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveOrgContext } from '@/lib/org-context';
import { AuthError } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const ctx = await resolveOrgContext(request);

        if (!ctx.organizationId) {
            return NextResponse.json({
                organization: null,
                role: ctx.role,
                message: 'No organization found. One will be created on your next action.',
            });
        }

        const { data: org, error } = await ctx.supabase
            .from('organizations')
            .select('id, name, slug, created_at')
            .eq('id', ctx.organizationId)
            .single();

        if (error || !org) {
            return NextResponse.json({
                organization: null,
                role: ctx.role,
                message: 'Organization record not found.',
            });
        }

        return NextResponse.json({
            organization: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                created_at: org.created_at,
            },
            role: ctx.role,
        });
    } catch (err) {
        if (err instanceof AuthError) {
            return NextResponse.json({ error: 'UNAUTHORIZED', message: err.message }, { status: 401 });
        }
        console.error('[organizations/current] Error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'Failed to resolve organization' },
            { status: 500 }
        );
    }
}
