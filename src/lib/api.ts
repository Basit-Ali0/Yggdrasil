// ============================================================
// API Client — Yggdrasil
// Typed fetch wrapper with error handling + retry
// Sends Supabase auth token on every request
// ============================================================

import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface ApiError {
    error: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
}

class ApiClientError extends Error {
    status: number;
    details?: Array<{ field: string; message: string }>;

    constructor(status: number, message: string, details?: ApiError['details']) {
        super(message);
        this.name = 'ApiClientError';
        this.status = status;
        this.details = details;
    }
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 2,
    baseDelay = 1000,
): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Don't retry client errors (4xx) except 429
            if (response.status === 429 && attempt < maxRetries) {
                await sleep(baseDelay * Math.pow(2, attempt));
                continue;
            }

            return response;
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await sleep(baseDelay * Math.pow(2, attempt));
        }
    }
    throw new Error('Exhausted retries');
}

async function getHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Attach Supabase auth token if available
    try {
        const supabase = getSupabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
    } catch {
        // No auth available — request will fail with 401
    }

    return headers;
}

export const api = {
    async get<T>(path: string): Promise<T> {
        const response = await fetchWithRetry(`/api${path}`, {
            method: 'GET',
            headers: await getHeaders(),
            credentials: 'same-origin',
        });

        const data = await response.json();

        if (!response.ok) {
            throw new ApiClientError(
                response.status,
                data.message || 'Request failed',
                data.details,
            );
        }

        return data as T;
    },

    async post<T>(path: string, body?: unknown): Promise<T> {
        const response = await fetchWithRetry(`/api${path}`, {
            method: 'POST',
            headers: await getHeaders(),
            credentials: 'same-origin',
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new ApiClientError(
                response.status,
                data.message || 'Request failed',
                data.details,
            );
        }

        return data as T;
    },

    async patch<T>(path: string, body: unknown): Promise<T> {
        const response = await fetchWithRetry(`/api${path}`, {
            method: 'PATCH',
            headers: await getHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new ApiClientError(
                response.status,
                data.message || 'Request failed',
                data.details,
            );
        }

        return data as T;
    },

    async upload<T>(path: string, formData: FormData): Promise<T> {
        // Don't set Content-Type — browser handles multipart boundary
        // But DO send the auth token
        const authHeaders: Record<string, string> = {};
        try {
            const supabase = getSupabaseBrowser();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                authHeaders['Authorization'] = `Bearer ${session.access_token}`;
            }
        } catch { /* no auth */ }

        const response = await fetchWithRetry(`/api${path}`, {
            method: 'POST',
            headers: authHeaders,
            credentials: 'same-origin',
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new ApiClientError(
                response.status,
                data.message || 'Upload failed',
                data.details,
            );
        }

        return data as T;
    },
};

export { ApiClientError };
