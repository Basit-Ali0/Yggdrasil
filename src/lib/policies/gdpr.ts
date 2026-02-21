// ============================================================
// GDPR Prebuilt Policy — 10 rules from knowledge/gdpr.json
// ============================================================

import { Rule } from '../types';

export const GDPR_POLICY_NAME = 'GDPR Compliance Pack';
export const GDPR_POLICY_TYPE = 'gdpr';

export const GDPR_RULES: Rule[] = [
    {
        rule_id: 'GDPR-001',
        name: 'Data Retention Period Enforcement',
        type: 'retention',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'created_at', operator: 'exists', value: null },
        policy_excerpt:
            'Personal data must not be retained beyond necessary period — checks for expired data retention.',
        policy_section: 'Article 5(1)(e) — Storage Limitation',
        is_active: true,
        description:
            'Implement automated data purge for records exceeding retention period defined in your data retention policy.',
    },
    {
        rule_id: 'GDPR-002',
        name: 'Consent Status Validation',
        type: 'consent',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'consent_status', operator: 'equals', value: 'pending' },
        policy_excerpt:
            'Processing requires valid consent — checks for consent records with missing or expired consent.',
        policy_section: 'Article 6(1)(a) — Lawfulness of Processing',
        is_active: true,
        description:
            'Obtain valid consent from data subjects before processing their personal data.',
    },
    {
        rule_id: 'GDPR-003',
        name: 'At-Rest Encryption Requirement',
        type: 'encryption',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'encrypted', operator: 'equals', value: false },
        policy_excerpt:
            'Personal data must be encrypted at rest — checks for unencrypted PII fields.',
        policy_section: 'Article 32 — Security of Processing',
        is_active: true,
        description:
            'Enable encryption at rest for all tables containing personal data.',
    },
    {
        rule_id: 'GDPR-004',
        name: 'Special Category Data Protection',
        type: 'prohibited',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'data_category', operator: 'contains', value: 'special_category' },
        policy_excerpt:
            'Special category data (health, biometrics) requires explicit consent and additional protections.',
        policy_section: 'Article 9 — Processing of Special Categories',
        is_active: true,
        description:
            'Ensure explicit consent is obtained and additional security measures are in place for special category data.',
    },
    {
        rule_id: 'GDPR-005',
        name: 'Right to Data Access (DSAR)',
        type: 'access',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'is_retrievable', operator: 'equals', value: false },
        policy_excerpt:
            'Data subjects have right to access their data — checks for accessibility of personal data.',
        policy_section: 'Article 15 — Right of Access',
        is_active: true,
        description:
            'Implement data subject access request (DSAR) functionality.',
    },
    {
        rule_id: 'GDPR-006',
        name: 'Right to Be Forgotten (Deletion)',
        type: 'retention',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'deletion_requested', operator: 'equals', value: true },
        policy_excerpt:
            'Check for records marked for deletion but not yet erased (right to be forgotten).',
        policy_section: 'Article 17 — Right to Erasure',
        is_active: true,
        description:
            'Permanently erase personal data within 30 days of deletion request.',
    },
    {
        rule_id: 'GDPR-007',
        name: 'Children Data — Parental Consent',
        type: 'consent',
        severity: 'HIGH',
        threshold: 16,
        time_window: null,
        conditions: { field: 'age', operator: 'less_than', value: 16 },
        policy_excerpt:
            'Children\'s data requires parental consent for processing (under 16 years old).',
        policy_section: 'Article 8 — Child\'s Consent',
        is_active: true,
        description:
            'Verify parental consent before processing data of minors.',
    },
    {
        rule_id: 'GDPR-008',
        name: 'Marketing Email Opt-Out Mechanism',
        type: 'format',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'marketing_consent', operator: 'equals', value: true },
        policy_excerpt:
            'Email communications require opt-out mechanism for marketing.',
        policy_section: 'Article 21 — Right to Object',
        is_active: true,
        description:
            'Implement one-click unsubscribe in all marketing communications.',
    },
    {
        rule_id: 'GDPR-009',
        name: 'Lawful Basis Documentation',
        type: 'access',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'lawful_basis', operator: 'exists', value: null },
        policy_excerpt:
            'All personal data processing must have documented lawful basis.',
        policy_section: 'Article 6 — Lawfulness of Processing',
        is_active: true,
        description:
            'Document lawful basis (consent, contract, legal obligation, vital interests, public task, legitimate interests) for all processing.',
    },
    {
        rule_id: 'GDPR-010',
        name: 'In-Transit Encryption (TLS)',
        type: 'encryption',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'tls_enabled', operator: 'equals', value: false },
        policy_excerpt:
            'Personal data in transit must be encrypted — checks for unencrypted transmission.',
        policy_section: 'Article 32 — Security of Processing',
        is_active: true,
        description:
            'Enable TLS 1.2+ for all data transmission.',
    },
];
