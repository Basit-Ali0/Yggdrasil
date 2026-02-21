// ============================================================
// Auth Store — Yggdrasil
// Real Supabase Auth
// ============================================================

import { create } from 'zustand';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // Actions
    initialize: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
    signOut: () => Promise<void>;
    clearError: () => void;

    // Computed
    getUserId: () => string | null;
    isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    session: null,
    isLoading: true,
    isInitialized: false,
    error: null,

    initialize: async () => {
        try {
            const supabase = getSupabaseBrowser();
            const { data: { session } } = await supabase.auth.getSession();

            set({
                user: session?.user ?? null,
                session: session ?? null,
                isLoading: false,
                isInitialized: true,
            });

            // Listen for auth changes
            supabase.auth.onAuthStateChange((_event, session) => {
                set({
                    user: session?.user ?? null,
                    session: session ?? null,
                    isLoading: false,
                });
            });
        } catch {
            set({ isLoading: false, isInitialized: true });
        }
    },

    signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            const supabase = getSupabaseBrowser();
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                set({ error: error.message, isLoading: false });
                return;
            }

            set({
                user: data.user,
                session: data.session,
                isLoading: false,
            });
        } catch {
            set({ error: 'Failed to sign in. Please try again.', isLoading: false });
        }
    },

    signUp: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            const supabase = getSupabaseBrowser();
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                set({ error: error.message, isLoading: false });
                return { needsConfirmation: false };
            }

            // If user needs email confirmation
            if (data.user && !data.session) {
                set({ isLoading: false });
                return { needsConfirmation: true };
            }

            set({
                user: data.user,
                session: data.session,
                isLoading: false,
            });

            return { needsConfirmation: false };
        } catch {
            set({ error: 'Failed to create account. Please try again.', isLoading: false });
            return { needsConfirmation: false };
        }
    },

    signOut: async () => {
        set({ isLoading: true });
        try {
            const supabase = getSupabaseBrowser();
            await supabase.auth.signOut();
            set({
                user: null,
                session: null,
                isLoading: false,
            });
        } catch {
            set({ isLoading: false });
        }
    },

    clearError: () => set({ error: null }),

    getUserId: () => {
        const { user } = get();
        return user?.id ?? null;
    },

    isAuthenticated: () => {
        const { session } = get();
        return !!session;
    },
}));
