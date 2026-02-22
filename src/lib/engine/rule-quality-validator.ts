/**
 * Rule Quality Validator
 * 
 * Validates extracted rules for quality and specificity.
 * Flags rules that are likely to cause high false positives.
 */

import type { Rule } from '../types';

export interface RuleQualityResult {
    valid: boolean;
    score: number; // 0-100
    warnings: string[];
    suggestions: string[];
}

// Transaction types that are commonly associated with fraud
const HIGH_RISK_TYPES = ['CASH_OUT', 'TRANSFER', 'WIRE'];
const LOW_RISK_TYPES = ['PAYMENT', 'DEBIT', 'CASH_IN', 'DEPOSIT'];

// Minimum conditions for a quality rule
const MIN_CONDITIONS = 2;

export function validateRuleQuality(rule: Rule): RuleQualityResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check 1: Transaction types specified?
    let hasTypeCondition = rule.type && !['single_transaction', 'behavioral'].includes(rule.type);
    
    // Also check if type is in conditions
    if (!hasTypeCondition && rule.conditions) {
        if ('AND' in rule.conditions && Array.isArray(rule.conditions.AND)) {
            hasTypeCondition = (rule.conditions.AND as any[]).some(c => c.field === 'type');
        } else if ('OR' in rule.conditions && Array.isArray(rule.conditions.OR)) {
            hasTypeCondition = (rule.conditions.OR as any[]).some(c => c.field === 'type');
        } else if ('field' in (rule.conditions as any)) {
            hasTypeCondition = (rule.conditions as any).field === 'type';
        }
    }
    
    if (!hasTypeCondition) {
        warnings.push('No transaction type restriction - will flag all transaction types');
        suggestions.push('Add transaction type filter (e.g., CASH_OUT, TRANSFER)');
        score -= 25;
    }

    // Check 2: Multiple conditions via AND?
    const conditionCount = countConditions(rule);
    if (conditionCount < MIN_CONDITIONS) {
        warnings.push(`Single-condition rule (has ${conditionCount}, needs ${MIN_CONDITIONS}+) - high false positive risk`);
        suggestions.push('Combine with account behavior conditions (e.g., account emptied, destination was empty)');
        score -= 20;
    }

    // Check 3: Threshold-only rule?
    if (isThresholdOnly(rule)) {
        warnings.push('Threshold-only rule without context');
        suggestions.push('Add account behavior or transaction pattern context');
        score -= 15;
    }

    // Check 4: Very low threshold?
    if (rule.threshold && rule.threshold < 5000) {
        warnings.push(`Low threshold ($${rule.threshold}) may cause excessive false positives`);
        suggestions.push('Consider raising threshold or adding context conditions');
        score -= 10;
    }

    // Check 5: Has time window but no other context?
    if (rule.time_window && conditionCount < 3) {
        warnings.push('Windowed rule needs more context conditions');
        suggestions.push('Add amount range or account behavior conditions');
        score -= 10;
    }

    // Positive checks
    if (hasAccountBehaviorCondition(rule)) {
        score += 10; // Bonus for account behavior awareness
    }

    if (hasCombinedSignals(rule)) {
        score += 15; // Bonus for multi-signal approach
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return {
        valid: score >= 50, // Require score >= 50 for valid rule
        score,
        warnings,
        suggestions,
    };
}

function countConditions(rule: Rule): number {
    let count = 0;

    // Amount condition
    if (rule.threshold !== null && rule.threshold !== undefined) {
        count++;
    }

    // Explicit conditions
    if (rule.conditions) {
        // Check if compound condition
        if ('AND' in rule.conditions && Array.isArray(rule.conditions.AND)) {
            count += rule.conditions.AND.length;
        } else if ('OR' in rule.conditions && Array.isArray(rule.conditions.OR)) {
            count += rule.conditions.OR.length;
        } else if ('field' in rule.conditions) {
            count++;
        }
    }

    // Time window
    if (rule.time_window) {
        count++;
    }

    // Transaction type specificity
    if (rule.type && rule.type !== 'single_transaction') {
        count++;
    }

    return count;
}

function isThresholdOnly(rule: Rule): boolean {
    // Rule has only a threshold and nothing else meaningful
    const hasOnlyThreshold = rule.threshold !== null && 
        rule.threshold !== undefined &&
        !rule.time_window;
    
    const conditionsCount = countConditions(rule);
    return hasOnlyThreshold && conditionsCount <= 1;
}

function hasAccountBehaviorCondition(rule: Rule): boolean {
    if (!rule.conditions) return false;

    const behaviorFields = [
        'oldbalanceOrg', 'newbalanceOrig', 'oldbalanceDest', 'newbalanceDest',
        'balance', 'account_emptied', 'destination_empty',
    ];

    // Check compound conditions
    if ('AND' in rule.conditions && Array.isArray(rule.conditions.AND)) {
        return (rule.conditions.AND as any[]).some(c => behaviorFields.includes(c.field));
    }
    if ('OR' in rule.conditions && Array.isArray(rule.conditions.OR)) {
        return (rule.conditions.OR as any[]).some(c => behaviorFields.includes(c.field));
    }
    
    // Check simple condition
    if ('field' in (rule.conditions as any)) {
        return behaviorFields.includes((rule.conditions as any).field);
    }
    
    return false;
}

function hasCombinedSignals(rule: Rule): boolean {
    // Check if rule combines multiple signal types
    const hasAmount = rule.threshold !== null && rule.threshold !== undefined;
    const hasType = rule.type && rule.type !== 'single_transaction';
    const hasTimeWindow = rule.time_window !== null;
    const hasBehavior = hasAccountBehaviorCondition(rule);

    const signalCount = [hasAmount, hasType, hasTimeWindow, hasBehavior].filter(Boolean).length;
    return signalCount >= 2;
}

export function suggestRuleImprovements(rule: Rule): string[] {
    const suggestions: string[] = [];
    const quality = validateRuleQuality(rule);

    if (quality.warnings.length === 0) {
        return ['Rule looks good!'];
    }

    // Build specific suggestions
    if (!rule.type || rule.type === 'single_transaction') {
        suggestions.push('Consider restricting to specific transaction types like CASH_OUT or TRANSFER');
    }

    if (isThresholdOnly(rule)) {
        suggestions.push('Combine threshold with account behavior context:');
        suggestions.push('  - Check if origin account was emptied');
        suggestions.push('  - Check if destination account was empty before');
        suggestions.push('  - Check for unusual transaction velocity');
    }

    if (rule.threshold && rule.threshold < 10000) {
        suggestions.push('For lower thresholds, add more context conditions to reduce false positives');
    }

    return suggestions;
}

export function scoreRuleSet(rules: Rule[]): {
    averageScore: number;
    highQualityCount: number;
    lowQualityCount: number;
    commonIssues: string[];
} {
    const scores = rules.map(r => validateRuleQuality(r).score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const highQualityCount = scores.filter(s => s >= 70).length;
    const lowQualityCount = scores.filter(s => s < 50).length;

    // Find common issues
    const issueCounts: Record<string, number> = {};
    for (const rule of rules) {
        const quality = validateRuleQuality(rule);
        for (const warning of quality.warnings) {
            issueCounts[warning] = (issueCounts[warning] || 0) + 1;
        }
    }

    const commonIssues = Object.entries(issueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([issue, count]) => `${issue} (${count} rules)`);

    return {
        averageScore,
        highQualityCount,
        lowQualityCount,
        commonIssues,
    };
}
