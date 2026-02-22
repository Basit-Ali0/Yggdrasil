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
 * Only normalizes rules with unknown/empty types. Prebuilt rules
 * (GDPR, SOC2, AML) already have correct types and must NOT be
 * reclassified by keyword matching.
 */
function normalizeRuleForEngine(rule: Rule): Rule {
    // If the rule already has a type recognized by the engine, keep it.
    // WINDOWED_RULE_TYPES are handled by executeWindowed; everything
    // else routes to executeSingleTx which checks conditions generically.
    // Only normalize rules with empty/null type.
    if (rule.type) {
        return rule;
    }

    const id = (rule.rule_id || '').toUpperCase();
    const desc = (rule.description || '').toLowerCase();
    const name = (rule.name || '').toLowerCase();
    const combined = `${id} ${desc} ${name}`;

    // Keyword-based categorization for LLM-extracted rules without a type
    // Priority: velocity > aggregation > threshold > behavioral

    // 1. Temporal / Velocity Patterns
    if (combined.includes('velocity') || combined.includes('rapid') || combined.includes('frequency')) {
        return { ...rule, type: 'velocity' };
    }

    // 2. Aggregations
    if (combined.includes('aggregate') || combined.includes('sum') || combined.includes('total')) {
        return { ...rule, type: 'aggregation' };
    }

    // 3. Single Transaction Thresholds
    if (combined.includes('threshold') || combined.includes('limit') || combined.includes('exceed')) {
        if (!rule.time_window) {
            return { ...rule, type: 'single_transaction' };
        }
    }

    // 4. Behavioral Anomalies
    if (combined.includes('anomaly') || combined.includes('unusual')) {
        return { ...rule, type: 'behavioral' };
    }

    // Default to single_transaction
    return { ...rule, type: 'single_transaction' };
}

/**
 * ML Scoring Model (L1)
 * Assigns a confidence score to each violation based on rule quality,
 * signal specificity, statistical anomaly detection, and historical precision.
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

    // 3. Bayesian Historical Precision (Feedback Loop)
    // Formula: (1 + TP) / (2 + TP + FP)
    const tp = rule.approved_count || 0;
    const fp = rule.false_positive_count || 0;
    const historicalPrecision = (1 + tp) / (2 + tp + fp);
    
    // We blend the historical precision with the rule quality score
    // If we have many reviews (> 5), we weight history more heavily
    const reviewCount = tp + fp;
    const historyWeight = Math.min(0.7, reviewCount / 20); // Cap history weight at 70%
    score = (score * (1 - historyWeight)) + (historicalPrecision * historyWeight);

    // 4. Criticality weighting
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
        trueViolationCount: number;
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
        let trueViolationCount = 0;

        console.log(`[EXECUTOR] Starting scan with ${activeRules.length} active rules against ${sampled.length} rows`);

        for (const rule of activeRules) {
            console.log(`[EXECUTOR] Running rule: ${rule.rule_id} (${rule.name})`);
            const engineRule = normalizeRuleForEngine(rule);
            const ruleViolations = this.backend.execute(
                engineRule,
                sampled,
                config.temporalScale
            );

            // Track the true violation count before capping (for accurate scoring)
            trueViolationCount += ruleViolations.length;

            // NOISE GATE: Cap stored violations per rule to prevent system overload
            const VIOLATION_CAP = 1000;
            let finalRuleViolations = ruleViolations;

            if (ruleViolations.length > VIOLATION_CAP) {
                console.warn(`[EXECUTOR] Rule ${rule.rule_id} is too noisy (${ruleViolations.length} hits). Storing top ${VIOLATION_CAP}.`);
                finalRuleViolations = ruleViolations.slice(0, VIOLATION_CAP);
            }

            console.log(`[EXECUTOR] Rule ${rule.rule_id} found ${ruleViolations.length} violations (stored ${finalRuleViolations.length})`);

            // Step 4: Scoring Layer (ML-Inspired)
            const scoredViolations = finalRuleViolations.map(v => ({
                ...v,
                confidence: calculateConfidence(v, rule, metadata)
            }));

            violations.push(...scoredViolations);
            rulesProcessed++;
        }

        console.log(`[EXECUTOR] Scan complete. Total violations: ${trueViolationCount} (stored: ${violations.length})`);

        // Step 5: Rank by confidence
        const rankedViolations = violations.sort((a, b) =>
            (b.confidence || 0) - (a.confidence || 0)
        );

        return {
            violations: rankedViolations,
            trueViolationCount,
            rulesProcessed,
            rulesTotal: activeRules.length,
        };
    }
}
