// ============================================================
// Optimized AML Rules — Low False Positive Design
// Based on empirical analysis of 50K transaction dataset
// ============================================================

import { Rule } from '../types';

export const OPTIMIZED_AML_RULES: Rule[] = [
    // ── TIER 1: HIGH SPECIFICITY (CRITICAL) ────────────────────
    // These rules require 3+ signals - highest confidence
    
    {
        rule_id: 'HIGH_RISK_FRAUD_PATTERN',
        name: 'High-Risk Fraud Pattern',
        type: 'fraud_indicator',
        severity: 'CRITICAL',
        threshold: null,
        time_window: null,
        conditions: {
            AND: [
                { field: 'type', operator: 'IN', value: ['CASH_OUT', 'TRANSFER'] },
                { field: 'oldbalanceOrg', operator: '>', value: 0 },
                { field: 'newbalanceOrig', operator: '==', value: 0 },
                { field: 'oldbalanceDest', operator: '==', value: 0 },
            ]
        },
        policy_excerpt: 'Transactions that empty the origin account to a new/empty destination account are high-risk fraud indicators.',
        policy_section: 'Section 5 - Fraud Detection',
        is_active: true,
        category: 'fraud_detection',
        description: 'Flag CASH_OUT/TRANSFER that empties account to empty destination (highest fraud correlation).',
        historical_context: {
            avg_fine: '$3.4B (Combined annual impact of transaction fraud)',
            breach_example: 'Attackers emptied accounts via rapid transfers to newly-created mule accounts.',
            article_reference: 'FFIEC IT Handbook',
        },
    },
    
    {
        rule_id: 'LARGE_CASHOUT_TO_NEW_ACCOUNT',
        name: 'Large Cash-Out to New Account',
        type: 'fraud_indicator',
        severity: 'CRITICAL',
        threshold: 50000,
        time_window: null,
        conditions: {
            AND: [
                { field: 'type', operator: '==', value: 'CASH_OUT' },
                { field: 'amount', operator: '>=', value: 50000 },
                { field: 'oldbalanceDest', operator: '==', value: 0 },
            ]
        },
        policy_excerpt: 'Large cash-outs to accounts with no prior balance require immediate review.',
        policy_section: 'Section 5 - High Value Monitoring',
        is_active: true,
        category: 'fraud_detection',
        description: 'Flag large CASH_OUT (>= $50K) to empty/new destination accounts.',
    },

    // ── TIER 2: MEDIUM SPECIFICITY (HIGH) ───────────────────────
    // These rules require 2+ signals - good confidence
    
    {
        rule_id: 'CTR_CASHOUT_TRANSFER',
        name: 'CTR for Cash-Out and Transfer Only',
        type: 'ctr_threshold',
        severity: 'HIGH',
        threshold: 10000,
        time_window: null,
        conditions: {
            AND: [
                { field: 'type', operator: 'IN', value: ['CASH_OUT', 'TRANSFER'] },
                { field: 'amount', operator: '>=', value: 10000 },
            ]
        },
        policy_excerpt: 'Transactions exceeding $10,000 via CASH_OUT or TRANSFER must be reported to FinCEN.',
        policy_section: 'Section 1 - Currency Transaction Reporting',
        is_active: true,
        category: 'ctr_reporting',
        description: 'Flag CASH_OUT and TRANSFER transactions >= $10,000 (CTR threshold).',
        historical_context: {
            avg_fine: '$1.4B (HSBC 2012 fine)',
            breach_example: 'Bank failed to monitor high-value cash transactions.',
            article_reference: '31 CFR 1010.311',
        },
    },
    
    {
        rule_id: 'ACCOUNT_DRAINED',
        name: 'Account Drained',
        type: 'fraud_indicator',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: {
            AND: [
                { field: 'type', operator: 'IN', value: ['CASH_OUT', 'TRANSFER'] },
                { field: 'oldbalanceOrg', operator: '>', value: 0 },
                { field: 'newbalanceOrig', operator: '==', value: 0 },
            ]
        },
        policy_excerpt: 'Transactions that completely drain an account balance may indicate unauthorized activity.',
        policy_section: 'Section 4 - Account Behavior Monitoring',
        is_active: true,
        category: 'behavioral_monitoring',
        description: 'Flag CASH_OUT/TRANSFER that completely empties the origin account.',
    },

    {
        rule_id: 'HIGH_VALUE_TRANSFER_TYPE',
        name: 'High Value Transfer (Filtered)',
        type: 'high_value_transfer',
        severity: 'HIGH',
        threshold: 50000,
        time_window: null,
        conditions: {
            AND: [
                { field: 'type', operator: 'IN', value: ['TRANSFER', 'WIRE'] },
                { field: 'amount', operator: '>', value: 50000 },
            ]
        },
        policy_excerpt: 'Wire and transfer transactions exceeding $50,000 require enhanced monitoring.',
        policy_section: 'Section 5 - High Value Transfer Monitoring',
        is_active: true,
        category: 'suspicious_activity',
        description: 'Flag TRANSFER/WIRE transactions > $50,000.',
    },

    // ── TIER 3: VELOCITY RULES (WITH TYPE FILTER) ──────────────
    
    {
        rule_id: 'STRUCTURING_CASHOUT_TRANSFER',
        name: 'Structuring Pattern (Filtered)',
        type: 'structuring',
        severity: 'CRITICAL',
        threshold: 3,
        time_window: 24,
        conditions: {
            AND: [
                { field: 'type', operator: 'IN', value: ['CASH_OUT', 'TRANSFER'] },
                { field: 'amount', operator: 'BETWEEN', value: [8000, 10000] },
            ]
        },
        policy_excerpt: 'Multiple CASH_OUT or TRANSFER transactions of $8K-$10K within 24 hours may indicate structuring.',
        policy_section: 'Section 2 - Structuring Detection',
        is_active: true,
        category: 'structuring',
        description: 'Detect 3+ CASH_OUT/TRANSFER transactions $8K-$10K within 24 hours.',
    },

    {
        rule_id: 'SAR_VELOCITY_FILTERED',
        name: 'SAR Velocity (Filtered)',
        type: 'sar_velocity',
        severity: 'HIGH',
        threshold: 25000,
        time_window: 24,
        conditions: {
            AND: [
                { field: 'type', operator: 'IN', value: ['CASH_OUT', 'TRANSFER', 'WIRE'] },
                { field: 'amount', operator: 'aggregate_sum', value: 25000 },
            ]
        },
        policy_excerpt: 'High volume of cash-out/transfer transactions within 24 hours may indicate suspicious activity.',
        policy_section: 'Section 3 - SAR Velocity',
        is_active: true,
        category: 'structuring',
        description: 'Flag accounts with > $25K in CASH_OUT/TRANSFER within 24 hours.',
    },

    // ── DISABLED: HIGH FALSE POSITIVE RULES ────────────────────
    // These rules caused 99%+ false positives - kept for reference
    
    // BALANCE_MISMATCH - Disabled: 35,509 flags, only 4 fraud (0.01% precision)
    // SAR_THRESHOLD on all types - Disabled: Too broad without type filter
    // ROUND_AMOUNT - Disabled: No correlation with fraud in this dataset
];

export const DISABLED_RULES: Rule[] = [
    {
        rule_id: 'BALANCE_MISMATCH',
        name: 'Balance Mismatch (DISABLED)',
        type: 'balance_mismatch',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'balance', operator: 'mismatch', value: 0.01 },
        policy_excerpt: 'Flag any transaction where the balance change does not match the transaction amount.',
        policy_section: 'Section 4 - Balance Verification',
        is_active: false, // DISABLED - 99.99% false positive rate
        category: 'behavioral_monitoring',
        description: 'DISABLED: Flags 35K+ transactions, only 4 are fraud.',
    },
];
