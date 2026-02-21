// ============================================================
// Temporal Normalization — per enforcement-spec.md
// IBM AML: temporal_scale = 24.0 (days → hours)
// PaySim: temporal_scale = 1.0 (already hours)
// ============================================================

/**
 * Normalize a time step to hours.
 * All windowed rules operate on hour-based windows (e.g., 24 hours).
 * With IBM data (days), step 1 → 24 hours. With PaySim (hours), step 1 → 1 hour.
 */
export function normalizeTime(step: number, scale: number): number {
    return step * scale;
}

/**
 * Check if two steps fall within the same window (in hours).
 */
export function withinWindow(
    step1: number,
    step2: number,
    windowHours: number,
    scale: number
): boolean {
    const t1 = normalizeTime(step1, scale);
    const t2 = normalizeTime(step2, scale);
    return Math.abs(t1 - t2) <= windowHours;
}

/**
 * Get the window key for grouping (floors to window boundary).
 */
export function getWindowKey(step: number, windowHours: number, scale: number): number {
    const normalizedHour = normalizeTime(step, scale);
    return Math.floor(normalizedHour / windowHours);
}
