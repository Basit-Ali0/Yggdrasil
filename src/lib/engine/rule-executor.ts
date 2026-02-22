// ============================================================
// RuleExecutor — Orchestrates: normalize → pre-filter → execute
// ============================================================

import { Rule, NormalizedRecord, ExecutionConfig } from '../types';
import { InMemoryBackend, ViolationResult } from './in-memory-backend';
import { normalizeRecord } from './schema-adapter';
import { validateRuleQuality } from './rule-quality-validator';
import { DatasetMetadata } from '../upload-store';

/**
 * Map Gemini-extracted rule IDs/types to engine-recognized IDs/types.
 * Uses generic patterns to categorize rules without domain-specific hardcoding.
 */
function normalizeRuleForEngine(rule: Rule): Rule {
    const id = (rule.rule_id || '').toUpperCase();
    const desc = (rule.description || '').toLowerCase();
    const name = (rule.name || '').toLowerCase();
    const combined = `${id} ${desc} ${name}`;

    // Generic categorization based on signal types
    
    // 1. Single Transaction Thresholds
    if (combined.includes('threshold') || combined.includes('limit') || combined.includes('exceed')) {
        if (!rule.time_window) {
            return { ...rule, type: 'single_transaction' };
        }
    }

    // 2. Temporal / Velocity Patterns
    if (combined.includes('velocity') || combined.includes('rapid') || combined.includes('frequency') || combined.includes('within')) {
        return { ...rule, type: 'velocity' };
    }

    // 3. Behavioral Anomalies
    if (combined.includes('anomaly') || combined.includes('unusual') || combined.includes('pattern') || combined.includes('change')) {
        return { ...rule, type: 'behavioral' };
    }

    // 4. Aggregations
    if (combined.includes('aggregate') || combined.includes('sum') || combined.includes('total')) {
        return { ...rule, type: 'aggregation' };
    }

    // Default to provided type or single_transaction
    return { ...rule, type: rule.type || 'single_transaction' };
}

/**
 * ML Scoring Model (L1)
 * Assigns a confidence score to each violation based on rule quality,
 * signal specificity, and statistical anomaly detection.
 */
function calculateConfidence(
    violation: ViolationResult, 
    rule: Rule, 
    metadata?: DatasetMetadata
): number {
    const quality = validateRuleQuality(rule);
    let score = quality.score / 100;

    // 1. Signal Specificity Boost
    if (rule.conditions && typeof rule.conditions === 'object') {
        if ('AND' in rule.conditions && Array.isArray(rule.conditions.AND)) {
            // More signals = higher confidence
            score += rule.conditions.AND.length * 0.05;
        }
    }

    // 2. Statistical Anomaly Detection (Simulated ML)
    if (metadata && violation.amount) {
        const stats = metadata.columnStats['amount'];
        
        if (stats && stats.type === 'numeric' && stats.mean) {
            // How many times larger than mean?
            const ratioToMean = violation.amount / stats.mean;
            
            if (ratioToMean > 10) score += 0.2; // Extreme outlier
            else if (ratioToMean > 5) score += 0.1;
            else if (ratioToMean < 0.1) score += 0.05;
        }
    }

    // 3. Criticality weighting
    if (rule.severity === 'CRITICAL') score += 0.1;

    return Math.max(0, Math.min(1, score));
}

export class RuleExecutor {
    private backend: InMemoryBackend;

    constructor() {
        this.backend = new InMemoryBackend();
    }

    /**
     * Execute all active rules against the dataset.
     * Returns all violations found, ranked by confidence.
     */
    executeAll(
        rules: Rule[],
        rawRecords: Record<string, any>[],
        config: ExecutionConfig,
        metadata?: DatasetMetadata
    ): {
        violations: ViolationResult[];
        rulesProcessed: number;
        rulesTotal: number;
    } {
        // Step 1: Normalize records using confirmed column mapping
        const normalized: NormalizedRecord[] = rawRecords.map((r) =>
            normalizeRecord(r, config.columnMapping)
        );

        // Step 2: Sample if over limit
        const sampled =
            normalized.length > config.sampleLimit
                ? normalized.slice(0, config.sampleLimit)
                : normalized;

        // Step 3: Execute each active rule
        const violations: ViolationResult[] = [];
        const activeRules = rules.filter((r) => r.is_active);
        let rulesProcessed = 0;

        for (const rule of activeRules) {
            const engineRule = normalizeRuleForEngine(rule);
            const ruleViolations = this.backend.execute(
                engineRule,
                sampled,
                config.temporalScale
            );
            
            // Step 4: Scoring Layer (ML-Inspired)
            const scoredViolations = ruleViolations.map(v => ({
                ...v,
                confidence: calculateConfidence(v, rule, metadata)
            }));

            violations.push(...scoredViolations);
            rulesProcessed++;
        }

        // Step 5: Rank by confidence
        const rankedViolations = violations.sort((a, b) => 
            ((b as any).confidence || 0) - ((a as any).confidence || 0)
        );

        return {
            violations: rankedViolations,
            rulesProcessed,
            rulesTotal: activeRules.length,
        };
    }
}
