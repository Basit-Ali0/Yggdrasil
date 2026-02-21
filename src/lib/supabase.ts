// ============================================================
// Supabase Server Client — Yggdrasil
// Supports: cookie auth → Bearer token → demo fallback
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

let _supabase: SupabaseClient | null = null;

/**
 * Simple Supabase client (no auth context) for general DB operations.
 * WARNING: Will fail on tables with RLS requiring auth.uid().
 */
export function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
        );
    }

    _supabase = createClient(url, key);
    return _supabase;
}

/**
 * Create an authenticated Supabase client from the request.
 * This client carries the user's JWT so RLS policies (auth.uid() = user_id) work.
 * 
 * In demo mode, uses the service role key to bypass RLS.
 */
export async function getSupabaseForRequest(request: NextRequest): Promise<SupabaseClient> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase env vars');
    }

    // Try Bearer token first — create a client that impersonates the user
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        // Create a fresh client with the user's access token
        // This ensures auth.uid() resolves correctly in RLS
        const client = createClient(url, key, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });
        return client;
    }

    // Try cookie-based SSR auth
    try {
        const ssrClient = createServerClient(url, key, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
            },
        });
        // Verify session exists
        const { data: { user } } = await ssrClient.auth.getUser();
        if (user) {
            return ssrClient;
        }
    } catch {
        // Cookie auth failed
    }

    // Demo mode: use service role key to bypass RLS
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && serviceKey) {
        return createClient(url, serviceKey);
    }

    // Last resort: return anon client (will fail on RLS-protected tables)
    return getSupabase();
}

/**
 * Extract the authenticated user ID from the request.
 * 
 * Tries 3 strategies in order:
 * 1. Cookie-based SSR auth (for SSR-rendered pages)
 * 2. Authorization Bearer token (for client-side fetch with localStorage session)
 * 3. Demo mode fallback (NEXT_PUBLIC_DEMO_MODE=true)
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase env vars');
    }

    // Strategy 1: Cookie-based auth via @supabase/ssr
    try {
        const ssrClient = createServerClient(url, key, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
            },
        });

        const { data: { user }, error } = await ssrClient.auth.getUser();
        if (!error && user) {
            return user.id;
        }
    } catch {
        // Cookie auth failed, try next strategy
    }

    // Strategy 2: Bearer token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            const tokenClient = createClient(url, key);
            const { data: { user }, error } = await tokenClient.auth.getUser(token);
            if (!error && user) {
                return user.id;
            }
        } catch {
            // Token auth failed, try next strategy
        }
    }

    // Strategy 3: Demo mode fallback
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        return DEMO_USER_ID;
    }

    throw new AuthError('Not authenticated');
}

/**
 * Custom error for auth failures — API routes catch this to return 401.
 */
export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

