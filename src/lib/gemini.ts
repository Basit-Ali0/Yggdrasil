// ============================================================
// Gemini wrapper — Vercel AI SDK generateObject + retry
// Per GracefulDegradation.md: 3 retries, exponential backoff
// ============================================================

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// ── Retry with exponential backoff ───────────────────────────

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxRetries: number; baseDelay: number } = {
        maxRetries: 3,
        baseDelay: 1000,
    }
): Promise<T> {
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === options.maxRetries) throw error;
            const delay = options.baseDelay * Math.pow(2, attempt);
            console.warn(
                `[Gemini] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
                error instanceof Error ? error.message : error
            );
            await sleep(delay);
        }
    }
    throw new Error('Exhausted retries');
}

// ── Circuit Breaker ──────────────────────────────────────────

class CircuitBreaker {
    private failures = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';
    private openedAt = 0;
    private readonly resetTimeout = 30000; // 30s before half-open

    canAttempt(): boolean {
        if (this.state === 'closed') return true;
        if (this.state === 'open') {
            // Check if enough time has passed to try again
            if (Date.now() - this.openedAt > this.resetTimeout) {
                this.state = 'half-open';
                return true;
            }
            return false;
        }
        return true; // half-open: try one
    }

    recordFailure(): void {
        this.failures++;
        if (this.failures >= 5) {
            this.state = 'open';
            this.openedAt = Date.now();
        }
    }

    recordSuccess(): void {
        this.failures = 0;
        this.state = 'closed';
    }
}

const geminiBreaker = new CircuitBreaker();

// ── Gemini generateObject wrapper ────────────────────────────

const MODEL_ID = 'gemini-2.5-flash';

/**
 * Call Gemini via Vercel AI SDK generateObject with retry + circuit breaker.
 * Returns typed structured output matching the provided Zod schema.
 */
export async function geminiGenerateObject<T extends z.ZodType>(opts: {
    schema: T;
    prompt: string;
    system?: string;
}): Promise<z.infer<T>> {
    if (!geminiBreaker.canAttempt()) {
        throw new Error(
            'Gemini circuit breaker is open — too many recent failures. Try again later.'
        );
    }

    try {
        const result = await withRetry(async () => {
            const { object } = await generateObject({
                model: google(MODEL_ID),
                schema: opts.schema,
                prompt: opts.prompt,
                system: opts.system,
            });
            return object;
        });

        geminiBreaker.recordSuccess();
        return result as z.infer<T>;
    } catch (error) {
        geminiBreaker.recordFailure();
        throw error;
    }
}
