// ============================================================
// SOC2 Prebuilt Policy — 12 rules from knowledge/soc2.json
// ============================================================

import { Rule } from '../types';

export const SOC2_POLICY_NAME = 'SOC2 Compliance Pack';
export const SOC2_POLICY_TYPE = 'soc2';

export const SOC2_RULES: Rule[] = [
    {
        rule_id: 'SOC2-CC6.1-001',
        name: 'Unauthorized Access Control',
        type: 'access',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'is_authorized', operator: 'equals', value: false },
        policy_excerpt:
            'Database access must be restricted to authorized users only — checks for unauthorized access patterns.',
        policy_section: 'CC6.1 — Logical and Physical Access Controls',
        is_active: true,
        description:
            'Implement role-based access control (RBAC) and remove unauthorized accounts.',
    },
    {
        rule_id: 'SOC2-CC6.1-002',
        name: 'Data Encryption at Rest',
        type: 'encryption',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'encryption_at_rest', operator: 'equals', value: false },
        policy_excerpt:
            'Sensitive data at rest must be encrypted — checks encryption status of sensitive fields.',
        policy_section: 'CC6.1 — Logical and Physical Access Controls',
        is_active: true,
        description:
            'Enable database-level encryption (TDE) and encrypt sensitive columns.',
    },
    {
        rule_id: 'SOC2-CC6.2-001',
        name: 'User Registration/Authorization',
        type: 'access',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'user_registered', operator: 'equals', value: false },
        policy_excerpt:
            'User access credentials must be properly registered before granting access.',
        policy_section: 'CC6.2 — Prior to Issuing System Credentials',
        is_active: true,
        description:
            'Implement formal user registration and authorization process.',
    },
    {
        rule_id: 'SOC2-CC6.3-001',
        name: 'Terminated User Deprovisioning',
        type: 'access',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'employment_status', operator: 'equals', value: 'terminated' },
        policy_excerpt:
            'Terminated user access must be promptly removed — checks for active accounts of terminated users.',
        policy_section: 'CC6.3 — Removal of Access',
        is_active: true,
        description:
            'Implement automated user deprovisioning process within 24 hours of termination.',
    },
    {
        rule_id: 'SOC2-CC6.3-002',
        name: 'Least Privilege Enforcement',
        type: 'access',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'privilege_level', operator: 'equals', value: 'admin' },
        policy_excerpt:
            'Access rights must follow least privilege principle — checks for excessive permissions.',
        policy_section: 'CC6.3 — Removal of Access',
        is_active: true,
        description:
            'Review and restrict elevated privileges to only those who require them.',
    },
    {
        rule_id: 'SOC2-CC7.2-001',
        name: 'Audit Logging Enablement',
        type: 'access',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'audit_logging_enabled', operator: 'equals', value: false },
        policy_excerpt:
            'System must monitor for anomalous access patterns — checks if audit logging is enabled.',
        policy_section: 'CC7.2 — Monitoring Activities',
        is_active: true,
        description:
            'Enable comprehensive audit logging for all database access.',
    },
    {
        rule_id: 'SOC2-CC7.2-002',
        name: 'Audit Log Retention (90+ Days)',
        type: 'retention',
        severity: 'MEDIUM',
        threshold: 90,
        time_window: null,
        conditions: { field: 'log_retention_days', operator: 'less_than', value: 90 },
        policy_excerpt:
            'Audit logs must be retained for sufficient period for security monitoring.',
        policy_section: 'CC7.2 — Monitoring Activities',
        is_active: true,
        description:
            'Retain audit logs for at least 90 days (SOC2 Type II typically requires 12 months).',
    },
    {
        rule_id: 'SOC2-CC7.3-001',
        name: 'Failed Authentication Logging',
        type: 'access',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'failed_auth_logged', operator: 'equals', value: false },
        policy_excerpt:
            'Failed authentication attempts must be logged and monitored.',
        policy_section: 'CC7.3 — Evaluation of Identified Events',
        is_active: true,
        description:
            'Implement logging of all failed authentication attempts.',
    },
    {
        rule_id: 'SOC2-CC8.1-001',
        name: 'Change Management Authorization',
        type: 'access',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'change_authorized', operator: 'equals', value: false },
        policy_excerpt:
            'Database changes must be authorized and documented.',
        policy_section: 'CC8.1 — Changes to Infrastructure',
        is_active: true,
        description:
            'Implement change management workflow with approval process.',
    },
    {
        rule_id: 'SOC2-C1.1-001',
        name: 'Data Retention Policy Alignment',
        type: 'retention',
        severity: 'MEDIUM',
        threshold: null,
        time_window: null,
        conditions: { field: 'retention_policy_exists', operator: 'equals', value: false },
        policy_excerpt:
            'Data retention procedures must conform to confidentiality commitments.',
        policy_section: 'C1.1 — Confidentiality Commitments',
        is_active: true,
        description:
            'Document and implement data retention policy aligned with contractual commitments.',
    },
    {
        rule_id: 'SOC2-CC6.6-001',
        name: 'External Access Boundary Protection',
        type: 'access',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'public_access', operator: 'equals', value: true },
        policy_excerpt:
            'External access must be restricted through boundary protection controls.',
        policy_section: 'CC6.6 — System Boundaries',
        is_active: true,
        description:
            'Implement firewall rules, VPN, or VPC to restrict external access.',
    },
    {
        rule_id: 'SOC2-CC6.7-001',
        name: 'Data Transmission Encryption',
        type: 'encryption',
        severity: 'HIGH',
        threshold: null,
        time_window: null,
        conditions: { field: 'in_transit_encryption', operator: 'equals', value: false },
        policy_excerpt:
            'Data transmission must be restricted and encrypted — checks for sensitive data in transit.',
        policy_section: 'CC6.7 — Transmission of Data',
        is_active: true,
        description:
            'Implement TLS/SSL for all data transmissions and restrict transmission methods.',
    },
];
