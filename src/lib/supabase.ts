// ============================================================
// Supabase Server Client — Yggdrasil
// Uses demo UUID for hackathon mode
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DEMO_USER_ID } from './types';

let _supabase: SupabaseClient | null = null;

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
 * Returns the current user ID.
 * In demo mode, returns the hardcoded demo UUID.
 * In production, would use Supabase Auth.
 */
export function getUserId(): string {
    // Hackathon: always demo mode
    return DEMO_USER_ID;
}
