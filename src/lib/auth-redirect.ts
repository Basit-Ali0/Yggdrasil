export function safeNextPath(next: string | null | undefined, fallback = '/audit/new'): string {
    if (!next) return fallback;
    const trimmed = next.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;

    try {
        const parsed = new URL(trimmed, 'http://yggdrasil.local');
        if (parsed.origin !== 'http://yggdrasil.local') return fallback;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return fallback;
    }
}
