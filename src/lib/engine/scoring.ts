// ============================================================
// Compliance Score Calculation — per ScoringMetrics.md
// Formula: 100 × (1 – weighted_violations / max_weighted_violations)
// ============================================================

import { SEVERITY_WEIGHTS } from '../types';

interface ViolationForScore {
    severity: string;
    status: string;
}

/**
 * Calculate the compliance score per ScoringMetrics.md.
 *
 * - Weights: CRITICAL=1.0, HIGH=0.75, MEDIUM=0.5
 * - Excludes violations with status === 'false_positive'
 * - formula: 100 × (1 - weighted_violations / (total_rows × 1.0))
 * - Clamp 0–100, round to 2 decimals
 * - Empty scans (0 rows) default to 100
 */
export function calculateComplianceScore(
    totalRowsScanned: number,
    violations: ViolationForScore[]
): number {
    if (totalRowsScanned === 0) return 100;

    // Filter out false positives
    const activeViolations = violations.filter(
        (v) => v.status !== 'false_positive'
    );

    // Calculate weighted violations
    const weightedViolations = activeViolations.reduce((sum, v) => {
        const weight = SEVERITY_WEIGHTS[v.severity] ?? 0;
        return sum + weight;
    }, 0);

    // Max possible weight
    const maxWeightedViolations = totalRowsScanned * 1.0;

    // Compute score
    const rawScore = 100 * (1 - weightedViolations / maxWeightedViolations);

    // Clamp 0–100 and round to 2 decimals
    return Math.round(Math.max(0, Math.min(100, rawScore)) * 100) / 100;
}

/**
 * Determine the score status and color based on thresholds.
 */
export function getScoreStatus(score: number): {
    status: string;
    color: string;
} {
    if (score < 50) return { status: 'critical', color: 'red' };
    if (score < 80) return { status: 'warning', color: 'yellow' };
    return { status: 'good', color: 'green' };
}

/**
 * Get the violation summary counts by severity.
 */
export function getViolationSummary(
    violations: ViolationForScore[]
): Record<string, number> {
    const activeViolations = violations.filter(
        (v) => v.status !== 'false_positive'
    );
    return {
        critical: activeViolations.filter((v) => v.severity === 'CRITICAL').length,
        high: activeViolations.filter((v) => v.severity === 'HIGH').length,
        medium: activeViolations.filter((v) => v.severity === 'MEDIUM').length,
    };
}
