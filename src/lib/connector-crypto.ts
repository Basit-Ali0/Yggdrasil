// ============================================================
// Connector credential encryption (AES-256-GCM)
// Server-side key from env: YGG_CONNECTOR_SECRET (32-byte hex or base64)
//
// DESIGN DECISION (P2):
// We use application-level AES-256-GCM rather than Supabase Vault because:
// 1. Supabase Vault is not available on all plans / self-hosted setups.
// 2. Vercel serverless functions need to decrypt creds at runtime without
//    a persistent Vault session or extra RPC round-trips.
// 3. The key lives in a single env var (YGG_CONNECTOR_SECRET), which can
//    be rotated by re-encrypting the credentials_enc column.
//
// Trade-off: the app process sees plaintext creds in memory during
// connector operations. Vault would keep them inside Postgres, but adds
// deployment constraints. If your deployment supports Vault, migrating
// is straightforward: replace encrypt/decrypt calls with vault_secret
// RPC and drop the BYTEA column.
// ============================================================

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
    const raw = process.env.YGG_CONNECTOR_SECRET;
    if (!raw) {
        throw new Error('YGG_CONNECTOR_SECRET env var is required for connector credential encryption');
    }
    if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
        return Buffer.from(raw, 'hex');
    }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
    throw new Error('YGG_CONNECTOR_SECRET must be 32 bytes (64 hex chars or 44 base64 chars)');
}

export function encryptCredentials(plaintext: string): Buffer {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: [iv (12)] [tag (16)] [ciphertext (N)]
    return Buffer.concat([iv, tag, encrypted]);
}

export function decryptCredentials(blob: Buffer): string {
    const key = getKey();
    const iv = blob.subarray(0, IV_LENGTH);
    const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = blob.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Check if connector encryption is available (env var set).
 */
export function isEncryptionAvailable(): boolean {
    try {
        getKey();
        return true;
    } catch {
        return false;
    }
}
