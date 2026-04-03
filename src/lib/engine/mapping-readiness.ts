// ============================================================
// Mapping readiness — required fields, previews, scan gate (P1-16–P1-22)
// ============================================================

import type { Rule } from '../types';
import { normalizeRuleForEngine } from './rule-engine-normalize';
import {
    HARDCODED_SINGLE_TX_RULE_IDS,
    isWindowedRuleType,
} from './rule-validation';
import { normalizeRecord } from './schema-adapter';

/** Logical fields produced by `normalizeRecord` / engine. */
export const NORMALIZED_FIELD_KEYS = [
    'account',
    'recipient',
    'amount',
    'step',
    'type',
    'oldbalanceOrg',
    'newbalanceOrig',
    'oldbalanceDest',
    'newbalanceDest',
] as const;

export type NormalizedFieldKey = (typeof NORMALIZED_FIELD_KEYS)[number];

const NORMALIZED_SET = new Set<string>(NORMALIZED_FIELD_KEYS);

function isNormalizedFieldKey(field: string): field is NormalizedFieldKey {
    return NORMALIZED_SET.has(field);
}

/**
 * Normalized fields required to execute this rule.
 *
 * Uses rule-family-specific requirements instead of a global CORE_FIELDS set:
 * - amount-based rules require amount
 * - step/windowed rules require step
 * - type-inspecting rules require type
 * - account grouping/identity rules require account
 * - balance rules require their specific balance fields
 * - generic rules require only their conditions.field (if normalized)
 */
export function requiredNormalizedFieldsForRule(rule: Rule): Set<string> {
    const r = normalizeRuleForEngine({ ...rule });
    const out = new Set<string>();

    if (isWindowedRuleType(r.type)) {
        // All windowed rules group by account and use step for temporal windows
        out.add('account');
        out.add('step');
        switch (r.type) {
            case 'ctr_aggregation':
                out.add('amount');
                out.add('recipient');
                break;
            case 'structuring':
            case 'sub_threshold_velocity':
            case 'sar_velocity':
            case 'round_amount':
            case 'dormant_reactivation':
                out.add('amount');
                break;
            // velocity_limit is unimplemented — no additional fields required
        }
        return out;
    }

    if (HARDCODED_SINGLE_TX_RULE_IDS.has(r.rule_id)) {
        switch (r.rule_id) {
            case 'CTR_THRESHOLD':
                out.add('amount');
                out.add('type');
                break;
            case 'SAR_THRESHOLD':
                out.add('amount');
                out.add('type');
                break;
            case 'BALANCE_MISMATCH':
                out.add('amount');
                out.add('oldbalanceOrg');
                out.add('newbalanceOrig');
                break;
            case 'FRAUD_INDICATOR':
                out.add('type');
                out.add('oldbalanceDest');
                out.add('newbalanceDest');
                break;
            case 'HIGH_VALUE_TRANSFER':
                out.add('amount');
                out.add('type');
                break;
            default:
                break;
        }
        return out;
    }

    // Generic executable rule
    // Only require the specific condition field (if it maps to a normalized key)
    const f = r.conditions?.field?.trim();
    if (f && isNormalizedFieldKey(f)) {
        out.add(f);
    }
    return out;
}

export function requiredNormalizedFieldsForRules(rules: Rule[]): Set<string> {
    const active = rules.filter((r) => r.is_active);
    const merged = new Set<string>();
    for (const rule of active) {
        for (const f of requiredNormalizedFieldsForRule(rule)) {
            merged.add(f);
        }
    }
    return merged;
}

export type MappingReadinessState = 'ready' | 'warning' | 'blocked';

export interface RuleFieldDependency {
    rule_id: string;
    rule_name: string;
    is_active: boolean;
    required_fields: string[];
}

export interface MappingReadinessResult {
    state: MappingReadinessState;
    missing_required: string[];
    invalid_columns: string[];
    warnings: string[];
    required_fields: string[];
    rule_dependencies: RuleFieldDependency[];
    sample_normalized_rows: Record<string, unknown>[];
}

function normalizeHeaderSet(headers: string[]): Set<string> {
    return new Set(headers.map((h) => h.trim().toLowerCase()).filter(Boolean));
}

/** CSV column used for a logical field (matches `normalizeRecord`: mapping[field] || field). */
export function effectiveCsvColumn(mapping: Record<string, string>, field: string): string {
    const raw = mapping[field];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return field;
}

function columnExistsInHeaders(column: string, headerLower: Set<string>): boolean {
    const c = column.trim().toLowerCase();
    if (!c) return false;
    return headerLower.has(c);
}

/**
 * Full readiness evaluation for operator UI and optional API/scan gate.
 */
export function evaluateMappingReadiness(options: {
    rules: Rule[];
    mapping: Record<string, string>;
    headers: string[];
    sampleRows: Record<string, unknown>[];
    mappingConfidence?: Record<string, number> | null;
    maxSampleRows?: number;
}): MappingReadinessResult {
    const {
        rules,
        mapping,
        headers,
        sampleRows,
        mappingConfidence,
        maxSampleRows = 3,
    } = options;

    const headerLower = normalizeHeaderSet(headers);
    const required = requiredNormalizedFieldsForRules(rules);
    const missing: string[] = [];
    const invalidColumns: string[] = [];

    // Check required normalized fields
    for (const field of [...required].sort()) {
        const col = effectiveCsvColumn(mapping, field);
        if (!col.trim()) {
            missing.push(field);
            continue;
        }
        if (headers.length > 0 && !columnExistsInHeaders(col, headerLower)) {
            invalidColumns.push(`${field} → "${col}" (not in upload headers)`);
        }
    }

    const warnings: string[] = [];

    // Warn on duplicate CSV column targets
    const csvTargets = new Map<string, string[]>();
    for (const field of NORMALIZED_FIELD_KEYS) {
        const col = effectiveCsvColumn(mapping, field);
        if (!col) continue;
        const k = col.toLowerCase();
        if (!csvTargets.has(k)) csvTargets.set(k, []);
        csvTargets.get(k)!.push(field);
    }
    for (const [col, fields] of csvTargets) {
        if (fields.length > 1) {
            warnings.push(
                `CSV column "${col}" is mapped to multiple logical fields: ${fields.join(', ')}`
            );
        }
    }

    // Low-confidence warnings for fields that are actually required
    if (mappingConfidence) {
        for (const field of required) {
            const c = mappingConfidence[field as string];
            if (c != null && c < 90) {
                warnings.push(
                    `Low mapping confidence for "${field}" (${c}%). Review before scanning.`
                );
            }
        }
    }

    // Custom (non-normalized) fields in active generic rules
    for (const rule of rules.filter((r) => r.is_active)) {
        const r = normalizeRuleForEngine(rule);
        const generic = !isWindowedRuleType(r.type) && !HARDCODED_SINGLE_TX_RULE_IDS.has(r.rule_id);
        if (!generic) continue;
        const f = r.conditions?.field?.trim();
        if (!f || isNormalizedFieldKey(f)) continue;

        // Non-normalized field: blocked only if explicitly mapped to a missing column
        const mappedCol = mapping[f];
        if (mappedCol && headers.length > 0 && !columnExistsInHeaders(mappedCol, headerLower)) {
            invalidColumns.push(`${f} → "${mappedCol}" (not in upload headers)`);
        } else {
            warnings.push(
                `Rule ${r.rule_id} uses condition field "${f}" which is not a standard ` +
                `transaction column. Ensure your dataset includes this column or adjust the rule.`
            );
        }
    }

    if (rules.filter((r) => r.is_active).length === 0) {
        warnings.push('No active rules found for this policy. Activate at least one rule before scanning.');
    }

    let state: MappingReadinessState;
    if (missing.length > 0 || invalidColumns.length > 0) {
        state = 'blocked';
    } else if (warnings.length > 0) {
        state = 'warning';
    } else {
        state = 'ready';
    }

    const rule_dependencies: RuleFieldDependency[] = rules.map((rule) => ({
        rule_id: rule.rule_id,
        rule_name: rule.name,
        is_active: rule.is_active,
        required_fields: [...requiredNormalizedFieldsForRule(rule)].sort(),
    }));

    const slice = sampleRows.slice(0, maxSampleRows);
    const sample_normalized_rows = slice.map((row) => {
        try {
            return normalizeRecord(row, mapping) as Record<string, unknown>;
        } catch {
            return { _error: 'normalize_failed' };
        }
    });

    return {
        state,
        missing_required: missing,
        invalid_columns: invalidColumns,
        warnings,
        required_fields: [...required].sort(),
        rule_dependencies,
        sample_normalized_rows,
    };
}

export function isMappingBlockedForScan(result: MappingReadinessResult): boolean {
    return result.state === 'blocked';
}
