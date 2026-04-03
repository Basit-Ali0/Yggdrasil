// ============================================================
// Single-line JSON logs for scan / engine events (P1-25)
// ============================================================

export function logStructured(
    component: string,
    event: string,
    payload: Record<string, unknown> = {}
): void {
    const line = {
        ts: new Date().toISOString(),
        component,
        event,
        ...payload,
    };
    console.info(JSON.stringify(line));
}
