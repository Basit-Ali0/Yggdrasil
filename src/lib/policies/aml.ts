// ============================================================
// AML Prebuilt Policy — Categorized Blueprint (11 Key Rules)
// ============================================================

import { Rule, PolicyCategory } from '../types';

export const AML_POLICY_NAME = 'AML Compliance Pack';
export const AML_POLICY_TYPE = 'aml';

export const AML_CATEGORIES: PolicyCategory[] = [
    {
        id: 'ctr_reporting',
        name: 'Currency Transaction Reporting',
        description: 'Reporting requirements for large cash transactions.',
    },
    {
        id: 'structuring',
        name: 'Structuring and Velocity',
        description: 'Detection of patterns intended to evade reporting thresholds.',
    },
    {
        id: 'suspicious_activity',
        name: 'Suspicious Activity Reporting',
        description: 'Detection and reporting of potentially illegal activity.',
    },
    {
        id: 'behavioral_monitoring',
        name: 'Account Behavior Monitoring',
        description: 'Monitoring for unusual account activity and dormant accounts.',
    },
    {
        id: 'fraud_detection',
        name: 'Fraud Detection',
        description: 'Identifying potential fraudulent transactions and patterns.',
    },
];

export const AML_RULES: Rule[] = [
    {
        rule_id: 'CTR_THRESHOLD',
        name: 'Currency Transaction Report Threshold',
        type: 'ctr_threshold',
        severity: 'CRITICAL',
        threshold: 10000,
        time_window: null,
        conditions: { field: 'amount', operator: '>=', value: 10000 },
        policy_excerpt:
            'Transactions exceeding $10,000 must be reported to FinCEN via a Currency Transaction Report.',
        policy_section: 'Section 1 - Currency Transaction Reporting',
        is_active: true,
        category: 'ctr_reporting',
        description: 'Flag transactions exceeding $10,000 CTR reporting threshold.',
        historical_context: {
            avg_fine: '$1.4B (HSBC 2012 fine - failure to monitor transactions)',
            breach_example: 'HSBC allowed $881M in money laundering by drug cartels.',
            article_reference: '31 CFR 1010.311',
        },
    },
    {
        rule_id: 'CTR_AGGREGATION',
        name: 'CTR Aggregation',
        type: 'ctr_aggregation',
        severity: 'CRITICAL',
        threshold: 10000,
        time_window: 24,
        conditions: { field: 'amount', operator: 'aggregate_sum', value: 10000 },
        policy_excerpt:
            'Multiple transactions by or on behalf of the same person during any one business day shall be aggregated for CTR purposes.',
        policy_section: 'Section 1 - CTR Aggregation',
        is_active: true,
        category: 'ctr_reporting',
        description: 'Flag when multiple transactions to same person aggregate > $10,000 in single day.',
        historical_context: {
            avg_fine: '$700M (FinCEN fine - systemic aggregation failure)',
            breach_example: 'Bank failed to aggregate multiple $9K cash deposits made same day.',
            article_reference: '31 CFR 1010.313',
        },
    },
    {
        rule_id: 'STRUCTURING_PATTERN',
        name: 'Structuring Pattern Detection',
        type: 'structuring',
        severity: 'CRITICAL',
        threshold: 3,
        time_window: 24,
        conditions: { field: 'amount', operator: 'BETWEEN', value: [8000, 10000] },
        policy_excerpt:
            'No person shall structure, or assist in structuring, any transaction for the purpose of evading the CTR reporting requirement.',
        policy_section: 'Section 2 - Structuring Detection',
        is_active: true,
        category: 'structuring',
        description: 'Detect structuring/smurfing — multiple transactions $8K–$10K within 24 hours.',
        historical_context: {
            avg_fine: '$200k+ (Individual fines for structuring)',
            breach_example: 'Customer made three $9,500 deposits over 3 days to avoid CTR.',
            article_reference: '31 USC 5324',
        },
    },
    {
        rule_id: 'SUB_THRESHOLD_VELOCITY',
        name: 'Sub-Threshold Velocity',
        type: 'sub_threshold_velocity',
        severity: 'HIGH',
        threshold: 5,
        time_window: 24,
        conditions: { field: 'amount', operator: 'BETWEEN', value: [8000, 10000] },
        policy_excerpt:
            'Flag any customer account with 5 or more transactions in a rolling 24-hour period where individual transaction amounts are between $8,000 and $10,000.',
        policy_section: 'Section 2 - Sub-Threshold Velocity',
        is_active: true,
        category: 'structuring',
        description: 'Flag 5+ sub-threshold transactions ($8K–$10K) in 24 hours.',
        historical_context: {
            avg_fine: '$2M (Institutional fine for pattern detection failure)',
            breach_example: 'Gambling site ignored frequent $9K transfers between users.',
            article_reference: '31 USC 5318(g)',
        },
    },
    {
        rule_id: 'SAR_THRESHOLD',
        name: 'Suspicious Activity Report Threshold',
        type: 'sar_threshold',
        severity: 'HIGH',
        threshold: 5000,
        time_window: null,
        conditions: { field: 'amount', operator: '>=', value: 5000 },
        policy_excerpt:
            'The Institution shall file a SAR for any transaction totaling $5,000 or more where it suspects the transaction involves funds derived from illegal activity.',
        policy_section: 'Section 3 - Suspicious Activity Reporting',
        is_active: true,
        category: 'suspicious_activity',
        description: 'Flag transactions >= $5K with suspicious patterns for SAR review.',
        historical_context: {
            avg_fine: '$450M (Capital One 2021 fine - SAR program failures)',
            breach_example: 'Bank failed to file SARs on millions of dollars in suspicious activity.',
            article_reference: '31 CFR 1020.320',
        },
    },
    {
        rule_id: 'SAR_VELOCITY',
        name: 'SAR Velocity',
        type: 'sar_velocity',
        severity: 'HIGH',
        threshold: 25000,
        time_window: 24,
        conditions: { field: 'amount', operator: 'aggregate_sum', value: 25000 },
        policy_excerpt:
            'Flag any individual account with transaction volume exceeding $25,000 within any 24-hour period.',
        policy_section: 'Section 3 - SAR Velocity',
        is_active: true,
        category: 'structuring',
        description: 'Flag accounts with > $25K in 24-hour period.',
        historical_context: {
            avg_fine: '$613M (U.S. Bancorp 2018 - capped transaction monitoring)',
            breach_example: 'Bank set monitoring thresholds too high, missing high-velocity smurfing.',
            article_reference: '31 CFR 1020.320',
        },
    },
    {
        rule_id: 'DORMANT_ACCOUNT_REACTIVATION',
        name: 'Dormant Account Reactivation',
        type: 'dormant_reactivation',
        severity: 'MEDIUM',
        threshold: 5000,
        time_window: 90,
        conditions: { field: 'amount', operator: '>', value: 5000 },
        policy_excerpt:
            'Flag any account inactive for 90+ days when that account conducts a transaction exceeding $5,000 within the first 30 days of reactivation.',
        policy_section: 'Section 4 - Account Behavior Monitoring',
        is_active: true,
        category: 'behavioral_monitoring',
        description: 'Flag high-value transactions from dormant accounts.',
        historical_context: {
            avg_fine: '$15M (Average fine for identity theft/money laundering via dormant accounts)',
            breach_example: 'Identity thieves hijacked dormant accounts to funnel fraudulent funds.',
            article_reference: 'FFIEC Guidance',
        },
    },
    {
        rule_id: 'BALANCE_MISMATCH',
        name: 'Balance Mismatch',
        type: 'balance_mismatch',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'balance', operator: 'mismatch', value: 0.01 },
        policy_excerpt:
            'Flag any transaction where the balance change does not match the transaction amount.',
        policy_section: 'Section 4 - Balance Verification',
        is_active: true,
        category: 'behavioral_monitoring',
        description: "Flag transactions where balance change doesn't match amount.",
        historical_context: {
            avg_fine: '$5M (Fine for poor internal controls)',
            breach_example: 'Technical error allowed double-spending, used as exploit by fraudsters.',
            article_reference: 'GAAP / FinCEN Controls',
        },
    },
    {
        rule_id: 'ROUND_AMOUNT_PATTERN',
        name: 'Round Amount Pattern',
        type: 'round_amount',
        severity: 'MEDIUM',
        threshold: 3,
        time_window: 720,
        conditions: { field: 'amount', operator: 'round_check', value: 1000 },
        policy_excerpt:
            'Flag any series of 3 or more round-dollar transactions within 30 days.',
        policy_section: 'Section 4 - Transaction Pattern Monitoring',
        is_active: true,
        category: 'behavioral_monitoring',
        description: 'Flag 3+ round-dollar transactions ($X,000) within 30 days.',
        historical_context: {
            avg_fine: '$1M (Indicator of sophisticated money laundering)',
            breach_example: 'Iterative $10,000, $20,000, and $5,000 transfers used to mask origin.',
            article_reference: 'FATF Guidance',
        },
    },
    {
        rule_id: 'FRAUD_INDICATOR',
        name: 'Fraud Indicator',
        type: 'fraud_indicator',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'oldbalanceDest', operator: '==', value: 0 },
        policy_excerpt:
            'Transactions to accounts with zero prior balance may indicate fraudulent activity.',
        policy_section: 'Section 5 - Fraud Detection',
        is_active: true,
        category: 'fraud_detection',
        description: 'Flag transactions to empty accounts (potential fraud).',
        historical_context: {
            avg_fine: '$3.4B (Combined annual impact of transaction fraud)',
            breach_example: 'Attacker emptied multiple newly-created accounts via rapid transfers.',
            article_reference: 'FFIEC IT Handbook',
        },
    },
    {
        rule_id: 'HIGH_VALUE_TRANSFER',
        name: 'High Value Transfer',
        type: 'high_value_transfer',
        severity: 'HIGH',
        threshold: 50000,
        time_window: null,
        conditions: { field: 'amount', operator: '>', value: 50000 },
        policy_excerpt: 'Flag any WIRE or TRANSFER transaction exceeding $50,000.',
        policy_section: 'Section 5 - High Value Transfer Monitoring',
        is_active: true,
        category: 'suspicious_activity',
        description: 'Flag wire/transfer transactions > $50,000.',
        historical_context: {
            avg_fine: '$100M+ (Penalty for failing to verify origin of funds)',
            breach_example: 'High-value wire transfers to shell companies in offshore jurisdictions.',
            article_reference: 'Travel Rule',
        },
    },
];
