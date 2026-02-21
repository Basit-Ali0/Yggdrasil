// ============================================================
// Supabase Server Client — Yggdrasil
// Supports: cookie auth → Bearer token
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

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
 */
export async function getSupabaseForRequest(request: NextRequest): Promise<SupabaseClient> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

    throw new AuthError('Not authenticated — no valid session found');
}

/**
 * Extract the authenticated user ID from the request.
 *
 * Tries 2 strategies in order:
 * 1. Cookie-based SSR auth (for SSR-rendered pages)
 * 2. Authorization Bearer token (for client-side fetch with session)
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
            // Token auth failed
        }
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

