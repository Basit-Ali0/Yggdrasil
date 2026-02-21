// ============================================================
// Schema Adapter — IBM AML / PaySim / Generic column mapping
// Hour-0 Bug #2 fix: correct column name mapping per dataset
// ============================================================

import { NormalizedRecord, DatasetType } from '../types';

// ── Column mapping tables from InMemoryBackend.md ────────────
// | Concept    | IBM AML        | PaySim     | Generic          |
// |------------|----------------|------------|------------------|
// | Sender     | orig_acct      | nameOrig   | account          |
// | Receiver   | bene_acct      | nameDest   | recipient        |
// | Amount     | base_amt       | amount     | amount           |
// | Time       | tran_timestamp | step       | timestamp        |
// | Type       | tx_type        | type       | transaction_type |

const IBM_AML_HEADERS = ['orig_acct', 'bene_acct', 'base_amt', 'tran_timestamp', 'tx_type'];
const PAYSIM_HEADERS = ['nameOrig', 'nameDest', 'step', 'isFraud'];

/**
 * Detect dataset type from CSV headers.
 */
export function detectDataset(headers: string[]): DatasetType {
    const headerSet = new Set(headers.map((h) => h.trim().toLowerCase()));

    // Check for IBM AML columns
    const ibmMatches = IBM_AML_HEADERS.filter((h) =>
        headerSet.has(h.toLowerCase())
    );
    if (ibmMatches.length >= 3) return 'IBM_AML';

    // Check for PaySim columns
    const paysimMatches = PAYSIM_HEADERS.filter((h) =>
        headerSet.has(h.toLowerCase())
    );
    if (paysimMatches.length >= 3) return 'PAYSIM';

    return 'GENERIC';
}

/**
 * Get temporal scale for a dataset type.
 * IBM AML: 24.0 (days → hours)
 * PaySim: 1.0 (already hours)
 */
export function getTemporalScale(datasetType: DatasetType): number {
    switch (datasetType) {
        case 'IBM_AML':
            return 24.0;
        case 'PAYSIM':
            return 1.0;
        default:
            return 1.0;
    }
}

/**
 * Get default column mapping suggestion for a dataset type.
 */
export function getDefaultMapping(
    datasetType: DatasetType
): Record<string, string> {
    switch (datasetType) {
        case 'IBM_AML':
            return {
                account: 'orig_acct',
                recipient: 'bene_acct',
                amount: 'base_amt',
                step: 'tran_timestamp',
                type: 'tx_type',
            };
        case 'PAYSIM':
            return {
                account: 'nameOrig',
                recipient: 'nameDest',
                amount: 'amount',
                step: 'step',
                type: 'type',
            };
        default:
            return {};
    }
}

/**
 * Normalize a raw CSV record into the standard NormalizedRecord shape
 * using the confirmed column mapping.
 */
export function normalizeRecord(
    raw: Record<string, any>,
    mapping: Record<string, string>
): NormalizedRecord {
    function get(field: string): any {
        const csvField = mapping[field] || field;
        return raw[csvField] ?? raw[field];
    }

    return {
        account: String(get('account') ?? ''),
        recipient: String(get('recipient') ?? ''),
        amount: parseFloat(get('amount')) || 0,
        step: parseFloat(get('step')) || 0,
        type: String(get('type') ?? ''),
        oldbalanceOrg: parseFloat(raw[mapping['oldbalanceOrg'] || 'oldbalanceOrg']) || 0,
        newbalanceOrig: parseFloat(raw[mapping['newbalanceOrig'] || 'newbalanceOrig']) || 0,
        oldbalanceDest: parseFloat(raw[mapping['oldbalanceDest'] || 'oldbalanceDest']) || 0,
        newbalanceDest: parseFloat(raw[mapping['newbalanceDest'] || 'newbalanceDest']) || 0,
        // Preserve all original fields for evidence / ground truth
        ...raw,
    };
}
