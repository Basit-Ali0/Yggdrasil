// ============================================================
// Ground Truth Validation — per evaluation.md
// Computes precision, recall, F1, FPR against labeled datasets
// ============================================================

import { ValidationMetrics } from '../types';

/**
 * Compute accuracy metrics comparing detected violations against
 * ground truth labels (IsLaundering for IBM, isFraud for PaySim).
 */
export function computeMetrics(
    detectedRecordIds: Set<string>,
    groundTruthPositiveIds: Set<string>,
    totalRecords: number
): ValidationMetrics {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    // TP: detected AND ground truth positive
    for (const id of detectedRecordIds) {
        if (groundTruthPositiveIds.has(id)) {
            tp++;
        } else {
            fp++;
        }
    }

    // FN: ground truth positive BUT not detected
    for (const id of groundTruthPositiveIds) {
        if (!detectedRecordIds.has(id)) {
            fn++;
        }
    }

    // TN: everything else
    const tn = totalRecords - tp - fp - fn;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 =
        precision + recall > 0
            ? (2 * (precision * recall)) / (precision + recall)
            : 0;
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;

    return {
        precision: Math.round(precision * 100) / 100,
        recall: Math.round(recall * 100) / 100,
        f1: Math.round(f1 * 100) / 100,
        fpr: Math.round(fpr * 100) / 100,
        tp,
        fp,
        fn,
        tn,
        summary: `Detected ${Math.round(recall * 100)}% of known violations with ${Math.round(fpr * 100)}% false positive rate`,
        validated_against:
            groundTruthPositiveIds.size > 0
                ? 'ground_truth_labels'
                : 'no_labels_available',
        total_labeled: groundTruthPositiveIds.size,
    };
}
