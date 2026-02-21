// ============================================================
// Supabase Server Client — Yggdrasil
// Real auth via @supabase/ssr cookie-based session
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

let _supabase: SupabaseClient | null = null;

/**
 * Simple Supabase client (no auth context) for general DB operations.
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
 * Extract the authenticated user ID from the request cookies.
 * Uses @supabase/ssr to read the Supabase session from HTTP cookies.
 * Returns the user ID string or throws if unauthenticated.
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase env vars');
    }

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
        },
    });

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        throw new AuthError('Not authenticated');
    }

    return user.id;
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
