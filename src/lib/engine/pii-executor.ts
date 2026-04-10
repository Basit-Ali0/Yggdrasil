// ============================================================
// PII Detection Executor — Yggdrasil
// Runs regex-based PII detection against dataset rows
// ============================================================

import type { PIIColumnAnalysis } from '@/lib/validators/pii';

export interface PIIExecutionResult {
    column_name: string;
    pii_type: string;
    severity: string;
    confidence: number;
    match_count: number;
    total_rows: number;
    match_percentage: number;
    masked_samples: string[];
    detection_regex: string;
    violation_text: string;
    suggestion: string;
}

// ── Fallback regex patterns by PII type ─────────────────────

export function getFallbackRegex(piiType: string): RegExp {
    switch (piiType) {
        case 'email':
            return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        case 'phone':
            return /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
        case 'ssn':
            return /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/;
        case 'credit_card':
            return /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/;
        case 'ip_address':
            return /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        default:
            return /.+/;
    }
}

// ── Mask PII values for safe display ────────────────────────

export function maskPII(value: string, piiType: string): string {
    if (!value || typeof value !== 'string') return '***';

    switch (piiType) {
        case 'email': {
            const atIndex = value.indexOf('@');
            if (atIndex <= 0) return '***@***.***';
            return value[0] + '***' + value.slice(atIndex);
        }
        case 'ssn': {
            // Show only last 4 digits
            const digits = value.replace(/\D/g, '');
            if (digits.length < 4) return '***-**-****';
            return '***-**-' + digits.slice(-4);
        }
        case 'credit_card': {
            const ccDigits = value.replace(/\D/g, '');
            if (ccDigits.length < 4) return '****-****-****-****';
            return '****-****-****-' + ccDigits.slice(-4);
        }
        case 'phone': {
            const phoneDigits = value.replace(/\D/g, '');
            if (phoneDigits.length < 4) return '***-***-****';
            return '***-***-' + phoneDigits.slice(-4);
        }
        default: {
            // Generic: first char + *** + last char
            if (value.length <= 2) return '***';
            return value[0] + '***' + value[value.length - 1];
        }
    }
}

// ── Strip JS regex literal delimiters ────────────────────────
// Gemini often returns "/pattern/flags" format but new RegExp() expects raw pattern

function parseRegexString(raw: string): RegExp {
    const literalMatch = raw.match(/^\/(.+)\/([gimsuy]*)$/);
    if (literalMatch) {
        return new RegExp(literalMatch[1], literalMatch[2]);
    }
    return new RegExp(raw);
}

// ── Execute PII detection against all rows ──────────────────

export function executePIIDetection(
    rows: Record<string, any>[],
    findings: PIIColumnAnalysis[],
): PIIExecutionResult[] {
    const results: PIIExecutionResult[] = [];

    for (const finding of findings) {
        // Only process columns that contain PII with sufficient confidence
        // Confidence is 0-100 scale
        if (!finding.contains_pii || finding.confidence < 60) continue;

        const piiType = finding.pii_type ?? 'other';

        // Compile the regex with fallback
        let regex: RegExp;
        try {
            if (!finding.detection_regex) throw new Error('No regex provided');
            regex = parseRegexString(finding.detection_regex);
        } catch {
            console.warn(
                `[PII] Invalid regex for ${finding.column_name}, using fallback for ${piiType}`,
            );
            regex = getFallbackRegex(piiType);
        }

        let matchCount = 0;
        const maskedSamples: string[] = [];
        const totalRows = rows.length;

        for (const row of rows) {
            const cellValue = row[finding.column_name];
            if (cellValue == null) continue;

            const strValue = String(cellValue);
            if (regex.test(strValue)) {
                matchCount++;

                // Collect up to 3 masked sample values
                if (maskedSamples.length < 3) {
                    maskedSamples.push(maskPII(strValue, piiType));
                }
            }
        }

        const matchPercentage = totalRows > 0
            ? Math.round((matchCount / totalRows) * 10000) / 100
            : 0;

        results.push({
            column_name: finding.column_name,
            pii_type: piiType,
            severity: finding.severity ?? 'MEDIUM',
            confidence: finding.confidence,
            match_count: matchCount,
            total_rows: totalRows,
            match_percentage: matchPercentage,
            masked_samples: maskedSamples,
            detection_regex: finding.detection_regex ?? '',
            violation_text: finding.violation_text ?? '',
            suggestion: finding.suggestion ?? '',
        });
    }

    return results;
}
