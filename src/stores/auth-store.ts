// ============================================================
// Auth Store — Yggdrasil
// Real Supabase Auth — no hardcoded user IDs
// ============================================================

import { create } from 'zustand';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { User, Session } from '@supabase/supabase-js';

// Demo account credentials (pre-created in Supabase)
const DEMO_EMAIL = 'demo@yggdrasil.ai';
const DEMO_PASSWORD = 'demo-yggdrasil-2024';

interface AuthState {
    user: User | null;
    session: Session | null;
    isDemo: boolean;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // Actions
    initialize: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
    signOut: () => Promise<void>;
    enableDemoMode: () => Promise<void>;
    clearError: () => void;

    // Computed
    getUserId: () => string | null;
    isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    session: null,
    isDemo: false,
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
                isDemo: false,
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
                isDemo: false,
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
                isDemo: false,
                isLoading: false,
            });
            // Clean up demo flag
            if (typeof window !== 'undefined') {
                localStorage.removeItem('demo_session');
            }
        } catch {
            set({ isLoading: false });
        }
    },

    enableDemoMode: async () => {
        // Demo mode = sign in with the pre-created demo account
        set({ isLoading: true, error: null });
        try {
            const supabase = getSupabaseBrowser();
            const { data, error } = await supabase.auth.signInWithPassword({
                email: DEMO_EMAIL,
                password: DEMO_PASSWORD,
            });

            if (error) {
                // If demo account doesn't exist yet, try to create it
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: DEMO_EMAIL,
                    password: DEMO_PASSWORD,
                });

                if (signUpError) {
                    set({
                        error: `Demo mode unavailable: ${signUpError.message}`,
                        isLoading: false,
                        isInitialized: true,
                    });
                    return;
                }

                set({
                    user: signUpData.user,
                    session: signUpData.session,
                    isDemo: true,
                    isLoading: false,
                    isInitialized: true,
                });
            } else {
                set({
                    user: data.user,
                    session: data.session,
                    isDemo: true,
                    isLoading: false,
                    isInitialized: true,
                });
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('demo_session', 'true');
            }
        } catch {
            set({
                error: 'Failed to enable demo mode.',
                isLoading: false,
                isInitialized: true,
            });
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
