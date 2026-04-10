// ============================================================
// Explainability — string template explanations
// Per explainability.md: NO Gemini calls, pure string templates
// ============================================================

import { NormalizedRecord, Rule } from '../types';

/**
 * Extract a human-readable summary of a rule's conditions.
 * Recursively walks AND/OR trees and builds a bullet list.
 */
function summarizeConditions(cond: any, record: NormalizedRecord, depth = 0): string {
    if (!cond) return '';
    const indent = '  '.repeat(depth);

    if ('AND' in cond && Array.isArray(cond.AND)) {
        const parts = cond.AND.map((c: any) => summarizeConditions(c, record, depth + 1));
        return `${indent}ALL of:\n${parts.join('\n')}`;
    }
    if ('OR' in cond && Array.isArray(cond.OR)) {
        const parts = cond.OR.map((c: any) => summarizeConditions(c, record, depth + 1));
        return `${indent}ANY of:\n${parts.join('\n')}`;
    }
    if ('field' in cond) {
        const actualValue = record[cond.field];
        if (cond.operator === 'exists') {
            return `${indent}- ${cond.field} is present (value: ${JSON.stringify(actualValue)})`;
        }
        if (cond.operator === 'not_exists') {
            return `${indent}- ${cond.field} is missing or empty (value: ${JSON.stringify(actualValue)})`;
        }
        return `${indent}- ${cond.field} ${cond.operator} ${JSON.stringify(cond.value)} (actual: ${JSON.stringify(actualValue)})`;
    }
    return '';
}

/**
 * Generate a human-readable explanation for a single-transaction violation.
 * Uses templates from explainability.md — never calls LLM.
 * Falls back to a generic condition-based explanation for non-AML rules.
 */
export function generateExplanation(
    rule: Rule,
    record: NormalizedRecord
): string {
    const recordId = record.account
        ? `${record.step}_${record.account}`
        : `record_${record.step}`;

    switch (rule.rule_id) {
        case 'CTR_THRESHOLD':
            return (
                `Transaction ${recordId} was flagged under CTR_THRESHOLD because:\n\n` +
                `- Amount: $${record.amount.toLocaleString()}\n` +
                `- Threshold: $10,000\n` +
                `- Transaction Type: ${record.type}\n` +
                `- Account: ${record.account}\n\n` +
                `Policy Reference: Section 1 - Currency Transaction Reporting\n` +
                `Severity: CRITICAL\n\n` +
                `This transaction exceeds the $10,000 CTR filing threshold and requires ` +
                `a Currency Transaction Report to be filed with FinCEN.`
            );

        case 'SAR_THRESHOLD':
            return (
                `Transaction ${recordId} was flagged under SAR_THRESHOLD because:\n\n` +
                `- Amount: $${record.amount.toLocaleString()}\n` +
                `- Threshold: $5,000\n` +
                `- Trigger: amount + suspicious pattern\n\n` +
                `Policy Reference: Section 3 - Suspicious Activity Reporting\n` +
                `Severity: HIGH\n\n` +
                `This transaction meets the SAR filing criteria.`
            );

        case 'BALANCE_MISMATCH': {
            const expected = record.oldbalanceOrg! - record.amount;
            const actual = record.newbalanceOrig!;
            const discrepancy = Math.abs(expected - actual);
            return (
                `Transaction ${recordId} was flagged under BALANCE_MISMATCH because:\n\n` +
                `- Transaction Amount: $${record.amount.toLocaleString()}\n` +
                `- Expected Balance Change: $${expected.toLocaleString()}\n` +
                `- Actual Balance Change: $${actual.toLocaleString()}\n` +
                `- Discrepancy: $${discrepancy.toLocaleString()}\n` +
                `- Account: ${record.account}\n\n` +
                `Policy Reference: Section 4 - Balance Verification\n` +
                `Severity: MEDIUM\n\n` +
                `The balance change does not match the transaction amount, indicating ` +
                `a potential data entry error or system issue.`
            );
        }

        case 'FRAUD_INDICATOR':
            return (
                `Transaction ${recordId} was flagged under FRAUD_INDICATOR because:\n\n` +
                `- Transaction Type: ${record.type}\n` +
                `- Recipient: ${record.recipient}\n` +
                `- Recipient Old Balance: $${(record.oldbalanceDest ?? 0).toLocaleString()}\n` +
                `- Recipient New Balance: $${(record.newbalanceDest ?? 0).toLocaleString()}\n\n` +
                `Policy Reference: Section 5 - Fraud Detection\n` +
                `Severity: HIGH\n\n` +
                `This transaction was sent to an account with zero prior balance, ` +
                `a common pattern in fraud schemes.`
            );

        case 'HIGH_VALUE_TRANSFER':
            return (
                `Transaction ${recordId} was flagged under HIGH_VALUE_TRANSFER because:\n\n` +
                `- Transaction Type: ${record.type}\n` +
                `- Amount: $${record.amount.toLocaleString()}\n` +
                `- Threshold: $50,000\n\n` +
                `Policy Reference: Section 5 - High Value Transfer Monitoring\n` +
                `Severity: HIGH\n\n` +
                `This wire/transfer exceeds the $50,000 monitoring threshold and ` +
                `requires enhanced review.`
            );

        default: {
            // Generic explanation using rule metadata and condition summary
            const lines: string[] = [];
            lines.push(`Record ${recordId} was flagged under ${rule.rule_id} (${rule.name}) because:\n`);

            if (rule.conditions) {
                lines.push(summarizeConditions(rule.conditions, record));
                lines.push('');
            }

            if (rule.policy_excerpt) {
                lines.push(`Policy Reference: ${rule.policy_section || 'N/A'}`);
                lines.push(`Excerpt: "${rule.policy_excerpt}"`);
            }

            lines.push(`Severity: ${rule.severity}`);

            if (rule.description) {
                // Description may be a JSON string from DB (serialized with historical_context)
                let descText = rule.description;
                try {
                    const parsed = JSON.parse(rule.description);
                    if (parsed.text) descText = parsed.text;
                } catch {
                    // Not JSON, use raw string
                }
                lines.push(`\n${descText}`);
            }

            return lines.join('\n');
        }
    }
}

/**
 * Generate explanation for windowed (account-level) violations.
 */
export function generateWindowedExplanation(
    rule: Rule,
    account: string,
    records: NormalizedRecord[],
    extras: Record<string, any> = {}
): string {
    const total = records.reduce((sum, r) => sum + r.amount, 0);
    const amounts = records.map((r) => `$${r.amount.toLocaleString()}`).join(', ');

    switch (rule.rule_id) {
        case 'CTR_AGGREGATION':
            return (
                `Account pair ${account} → ${extras.recipient ?? 'multiple'} was flagged under CTR_AGGREGATION because:\n\n` +
                `- Aggregate Amount: $${total.toLocaleString()}\n` +
                `- Transaction Count: ${records.length}\n` +
                `- Time Window: 24 hours\n` +
                `- Individual Amounts: ${amounts}\n\n` +
                `Policy Reference: Section 1 - CTR Aggregation\n` +
                `Severity: CRITICAL\n\n` +
                `Multiple transactions to the same person within 24 hours exceeded the ` +
                `$10,000 aggregate CTR threshold.`
            );

        case 'STRUCTURING_PATTERN':
            return (
                `Account ${account} was flagged under STRUCTURING_PATTERN because:\n\n` +
                `- Transaction Count: ${records.length}\n` +
                `- Individual Amounts: ${amounts} (all between $8,000-$10,000)\n` +
                `- Total Amount: $${total.toLocaleString()}\n` +
                `- Time Window: 24 hours\n\n` +
                `Policy Reference: Section 2 - Structuring Detection\n` +
                `Severity: CRITICAL\n\n` +
                `This account conducted ${records.length} transactions just under the $10,000 ` +
                `CTR threshold within 24 hours, suggesting intentional structuring ` +
                `to avoid reporting requirements.`
            );

        case 'SUB_THRESHOLD_VELOCITY':
            return (
                `Account ${account} was flagged under SUB_THRESHOLD_VELOCITY because:\n\n` +
                `- Transaction Count: ${records.length} (minimum: 5)\n` +
                `- Amount Range: $8,000 - $10,000 each\n` +
                `- Time Window: 24 hours\n\n` +
                `Policy Reference: Section 2 - Sub-Threshold Velocity\n` +
                `Severity: HIGH\n\n` +
                `This account exceeded the velocity threshold with ${records.length} sub-threshold ` +
                `transactions, indicating potential structuring activity.`
            );

        case 'SAR_VELOCITY':
            return (
                `Account ${account} was flagged under SAR_VELOCITY because:\n\n` +
                `- Total Volume: $${total.toLocaleString()}\n` +
                `- Transaction Count: ${records.length}\n` +
                `- Time Window: 24 hours\n` +
                `- Threshold: $25,000\n\n` +
                `Policy Reference: Section 3 - SAR Velocity\n` +
                `Severity: HIGH\n\n` +
                `This account exceeded the $25,000 daily transaction volume threshold.`
            );

        case 'DORMANT_ACCOUNT_REACTIVATION':
            return (
                `Account ${account} was flagged under DORMANT_ACCOUNT_REACTIVATION because:\n\n` +
                `- Transaction Amount: $${(extras.amount ?? total).toLocaleString()}\n` +
                `- Days Dormant: ${extras.daysDormant ?? 'unknown'}\n` +
                `- Days Since Reactivation: ${extras.daysSince ?? 'unknown'}\n` +
                `- Dormancy Threshold: 90 days\n` +
                `- Reactivation Threshold: $5,000\n\n` +
                `Policy Reference: Section 4 - Account Behavior Monitoring\n` +
                `Severity: MEDIUM\n\n` +
                `This account had been inactive for ${extras.daysDormant ?? '90+'} days before ` +
                `conducting a transaction exceeding $5,000.`
            );

        case 'ROUND_AMOUNT_PATTERN':
            return (
                `Account ${account} was flagged under ROUND_AMOUNT_PATTERN because:\n\n` +
                `- Transaction Count: ${records.length} (minimum: 3)\n` +
                `- Amounts: ${amounts}\n` +
                `- Time Window: 30 days\n\n` +
                `Policy Reference: Section 4 - Transaction Pattern Monitoring\n` +
                `Severity: MEDIUM\n\n` +
                `This account conducted ${records.length} round-dollar transactions within ` +
                `30 days, which may indicate intentional amount selection ` +
                `to avoid detection.`
            );

        default: {
            const lines: string[] = [];
            lines.push(`Account ${account} was flagged under ${rule.rule_id} (${rule.name}) because:\n`);
            lines.push(`- Transaction Count: ${records.length}`);
            lines.push(`- Total Amount: $${total.toLocaleString()}`);
            if (extras.actual_value != null) {
                lines.push(`- Measured Value: ${extras.actual_value}`);
            }
            if (rule.policy_excerpt) {
                lines.push(`\nPolicy Reference: ${rule.policy_section || 'N/A'}`);
                lines.push(`Excerpt: "${rule.policy_excerpt}"`);
            }
            lines.push(`Severity: ${rule.severity}`);
            return lines.join('\n');
        }
    }
}
