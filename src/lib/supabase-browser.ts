// ============================================================
// Supabase Browser Client — Yggdrasil
// Client-side only. Uses NEXT_PUBLIC_ env vars for auth.
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseBrowser: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
    if (_supabaseBrowser) return _supabaseBrowser;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
        );
    }

    _supabaseBrowser = createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
    return _supabaseBrowser;
}
