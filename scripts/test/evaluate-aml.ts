#!/usr/bin/env npx tsx
/**
 * AML Evaluation Script
 * 
 * This script evaluates the AML rule engine against a ground truth dataset.
 * It calculates precision, recall, F1 score, and accuracy by comparing
 * system-flagged transactions against the `isFraud` column.
 * 
 * Usage:
 *   npx tsx scripts/evaluate-aml.ts [path/to/dataset.csv]
 * 
 * If no path is provided, defaults to public/fraud_detection_subset_50k.csv
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────

interface RawRecord {
    step: string;
    type: string;
    amount: string;
    nameOrig: string;
    oldbalanceOrg: string;
    newbalanceOrig: string;
    nameDest: string;
    oldbalanceDest: string;
    newbalanceDest: string;
    isFraud: string;
    isFlaggedFraud: string;
}

interface NormalizedRecord {
    account: string;
    recipient: string;
    amount: number;
    step: number;
    type: string;
    oldbalanceOrg: number;
    newbalanceOrig: number;
    oldbalanceDest: number;
    newbalanceDest: number;
    isFraud: number;
    isFlaggedFraud: number;
    rawIndex: number;
}

interface Violation {
    rule_id: string;
    rule_name: string;
    severity: string;
    account: string;
    amount: number;
    transaction_type: string;
    record_indices: number[];
}

interface EvaluationResult {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
    precision: number;
    recall: number;
    f1_score: number;
    accuracy: number;
    total_transactions: number;
    actual_fraud_count: number;
    detected_count: number;
    detection_rate: number;
    false_positive_rate: number;
    rule_breakdown: Record<string, { detected: number; fraud_in_detected: number }>;
}

// ── Constants ─────────────────────────────────────────────────

const TEMPORAL_SCALE = 1.0; // PaySim uses hours as steps

// ── CSV Parser ────────────────────────────────────────────────

function parseCSV(filePath: string): RawRecord[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const records: RawRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const record: any = {};
        headers.forEach((h, idx) => {
            record[h] = values[idx]?.trim() ?? '';
        });
        records.push(record as RawRecord);
    }
    
    return records;
}

function normalizeRecords(raw: RawRecord[]): NormalizedRecord[] {
    return raw.map((r, idx) => ({
        account: r.nameOrig,
        recipient: r.nameDest,
        amount: parseFloat(r.amount) || 0,
        step: parseFloat(r.step) || 0,
        type: r.type,
        oldbalanceOrg: parseFloat(r.oldbalanceOrg) || 0,
        newbalanceOrig: parseFloat(r.newbalanceOrig) || 0,
        oldbalanceDest: parseFloat(r.oldbalanceDest) || 0,
        newbalanceDest: parseFloat(r.newbalanceDest) || 0,
        isFraud: parseInt(r.isFraud) || 0,
        isFlaggedFraud: parseInt(r.isFlaggedFraud) || 0,
        rawIndex: idx,
    }));
}

// ── Time Window Helper ────────────────────────────────────────

function getWindowKey(step: number, windowHours: number, scale: number): number {
    const scaledStep = step * scale;
    return Math.floor(scaledStep / windowHours);
}

// ── Rule Implementations ──────────────────────────────────────

function checkCtrThreshold(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const validTypes = ['CASH_OUT', 'TRANSFER', 'DEPOSIT', 'CASH_IN'];
    
    for (const r of records) {
        if (r.amount >= 10000 && validTypes.includes(r.type.toUpperCase())) {
            violations.push({
                rule_id: 'CTR_THRESHOLD',
                rule_name: 'Currency Transaction Report Threshold',
                severity: 'CRITICAL',
                account: r.account,
                amount: r.amount,
                transaction_type: r.type,
                record_indices: [r.rawIndex],
            });
        }
    }
    
    return violations;
}

function checkSarThreshold(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const validTypes = ['WIRE', 'TRANSFER'];
    
    for (const r of records) {
        if (r.amount >= 5000 && validTypes.includes(r.type.toUpperCase())) {
            violations.push({
                rule_id: 'SAR_THRESHOLD',
                rule_name: 'Suspicious Activity Report Threshold',
                severity: 'HIGH',
                account: r.account,
                amount: r.amount,
                transaction_type: r.type,
                record_indices: [r.rawIndex],
            });
        }
    }
    
    return violations;
}

function checkHighValueTransfer(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const validTypes = ['WIRE', 'TRANSFER'];
    
    for (const r of records) {
        if (r.amount > 50000 && validTypes.includes(r.type.toUpperCase())) {
            violations.push({
                rule_id: 'HIGH_VALUE_TRANSFER',
                rule_name: 'High Value Transfer',
                severity: 'HIGH',
                account: r.account,
                amount: r.amount,
                transaction_type: r.type,
                record_indices: [r.rawIndex],
            });
        }
    }
    
    return violations;
}

function checkFraudIndicator(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    
    for (const r of records) {
        const isCashOutOrTransfer = ['CASH_OUT', 'TRANSFER'].includes(r.type.toUpperCase());
        const destWasEmpty = r.oldbalanceDest === 0;
        const destNowHasFunds = r.newbalanceDest > 0;
        
        if (isCashOutOrTransfer && destWasEmpty && destNowHasFunds) {
            violations.push({
                rule_id: 'FRAUD_INDICATOR',
                rule_name: 'Fraud Indicator',
                severity: 'HIGH',
                account: r.account,
                amount: r.amount,
                transaction_type: r.type,
                record_indices: [r.rawIndex],
            });
        }
    }
    
    return violations;
}

function checkBalanceMismatch(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    
    for (const r of records) {
        const expectedAfterSend = r.oldbalanceOrg - r.amount;
        const mismatch = Math.abs(expectedAfterSend - r.newbalanceOrig);
        
        if (mismatch > 0.01) {
            violations.push({
                rule_id: 'BALANCE_MISMATCH',
                rule_name: 'Balance Mismatch',
                severity: 'MEDIUM',
                account: r.account,
                amount: r.amount,
                transaction_type: r.type,
                record_indices: [r.rawIndex],
            });
        }
    }
    
    return violations;
}

function checkStructuring(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const grouped = new Map<string, NormalizedRecord[]>();
    
    // Filter to sub-threshold amounts ($8K-$10K)
    const filtered = records.filter(r => r.amount >= 8000 && r.amount < 10000);
    
    // Group by account
    for (const r of filtered) {
        if (!grouped.has(r.account)) grouped.set(r.account, []);
        grouped.get(r.account)!.push(r);
    }
    
    // Check for 3+ in 24h window
    for (const [account, accRecords] of grouped) {
        const windows = new Map<number, NormalizedRecord[]>();
        
        for (const r of accRecords) {
            const wk = getWindowKey(r.step, 24, TEMPORAL_SCALE);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }
        
        for (const [, txns] of windows) {
            if (txns.length >= 3) {
                violations.push({
                    rule_id: 'STRUCTURING_PATTERN',
                    rule_name: 'Structuring Pattern Detection',
                    severity: 'CRITICAL',
                    account,
                    amount: txns.reduce((s, r) => s + r.amount, 0),
                    transaction_type: txns[0].type,
                    record_indices: txns.map(r => r.rawIndex),
                });
            }
        }
    }
    
    return violations;
}

function checkSubThresholdVelocity(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const grouped = new Map<string, NormalizedRecord[]>();
    
    const filtered = records.filter(r => r.amount >= 8000 && r.amount < 10000);
    
    for (const r of filtered) {
        if (!grouped.has(r.account)) grouped.set(r.account, []);
        grouped.get(r.account)!.push(r);
    }
    
    for (const [account, accRecords] of grouped) {
        const windows = new Map<number, NormalizedRecord[]>();
        
        for (const r of accRecords) {
            const wk = getWindowKey(r.step, 24, TEMPORAL_SCALE);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }
        
        for (const [, txns] of windows) {
            if (txns.length >= 5) {
                violations.push({
                    rule_id: 'SUB_THRESHOLD_VELOCITY',
                    rule_name: 'Sub-Threshold Velocity',
                    severity: 'HIGH',
                    account,
                    amount: txns.reduce((s, r) => s + r.amount, 0),
                    transaction_type: txns[0].type,
                    record_indices: txns.map(r => r.rawIndex),
                });
            }
        }
    }
    
    return violations;
}

function checkSarVelocity(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const grouped = new Map<string, NormalizedRecord[]>();
    
    for (const r of records) {
        if (!grouped.has(r.account)) grouped.set(r.account, []);
        grouped.get(r.account)!.push(r);
    }
    
    for (const [account, accRecords] of grouped) {
        const windows = new Map<number, NormalizedRecord[]>();
        
        for (const r of accRecords) {
            const wk = getWindowKey(r.step, 24, TEMPORAL_SCALE);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }
        
        for (const [, txns] of windows) {
            const total = txns.reduce((s, r) => s + r.amount, 0);
            if (total > 25000) {
                violations.push({
                    rule_id: 'SAR_VELOCITY',
                    rule_name: 'SAR Velocity',
                    severity: 'HIGH',
                    account,
                    amount: total,
                    transaction_type: txns[0].type,
                    record_indices: txns.map(r => r.rawIndex),
                });
            }
        }
    }
    
    return violations;
}

function checkCtrAggregation(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const grouped = new Map<string, NormalizedRecord[]>();
    
    for (const r of records) {
        const key = `${r.account}_${r.recipient}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(r);
    }
    
    for (const [, pairRecords] of grouped) {
        const windows = new Map<number, NormalizedRecord[]>();
        
        for (const r of pairRecords) {
            const wk = getWindowKey(r.step, 24, TEMPORAL_SCALE);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }
        
        for (const [, txns] of windows) {
            if (txns.length > 1) {
                const total = txns.reduce((s, r) => s + r.amount, 0);
                if (total >= 10000) {
                    violations.push({
                        rule_id: 'CTR_AGGREGATION',
                        rule_name: 'CTR Aggregation',
                        severity: 'CRITICAL',
                        account: txns[0].account,
                        amount: total,
                        transaction_type: txns[0].type,
                        record_indices: txns.map(r => r.rawIndex),
                    });
                }
            }
        }
    }
    
    return violations;
}

function checkRoundAmount(records: NormalizedRecord[]): Violation[] {
    const violations: Violation[] = [];
    const grouped = new Map<string, NormalizedRecord[]>();
    
    const isRound = (x: number) => x % 1000 === 0;
    const filtered = records.filter(r => isRound(r.amount));
    
    for (const r of filtered) {
        if (!grouped.has(r.account)) grouped.set(r.account, []);
        grouped.get(r.account)!.push(r);
    }
    
    for (const [account, accRecords] of grouped) {
        const windows = new Map<number, NormalizedRecord[]>();
        
        // 30 days = 720 hours
        for (const r of accRecords) {
            const wk = getWindowKey(r.step, 720, TEMPORAL_SCALE);
            if (!windows.has(wk)) windows.set(wk, []);
            windows.get(wk)!.push(r);
        }
        
        for (const [, txns] of windows) {
            if (txns.length >= 3) {
                violations.push({
                    rule_id: 'ROUND_AMOUNT_PATTERN',
                    rule_name: 'Round Amount Pattern',
                    severity: 'MEDIUM',
                    account,
                    amount: txns.reduce((s, r) => s + r.amount, 0),
                    transaction_type: txns[0].type,
                    record_indices: txns.map(r => r.rawIndex),
                });
            }
        }
    }
    
    return violations;
}

// ── Main Execution ────────────────────────────────────────────

function runAllRules(records: NormalizedRecord[]): Violation[] {
    const allViolations: Violation[] = [];
    
    console.log('Running AML rules...\n');
    
    // Single-transaction rules
    const ctrViolations = checkCtrThreshold(records);
    console.log(`  CTR_THRESHOLD: ${ctrViolations.length} violations`);
    allViolations.push(...ctrViolations);
    
    const sarViolations = checkSarThreshold(records);
    console.log(`  SAR_THRESHOLD: ${sarViolations.length} violations`);
    allViolations.push(...sarViolations);
    
    const highValueViolations = checkHighValueTransfer(records);
    console.log(`  HIGH_VALUE_TRANSFER: ${highValueViolations.length} violations`);
    allViolations.push(...highValueViolations);
    
    const fraudViolations = checkFraudIndicator(records);
    console.log(`  FRAUD_INDICATOR: ${fraudViolations.length} violations`);
    allViolations.push(...fraudViolations);
    
    const balanceViolations = checkBalanceMismatch(records);
    console.log(`  BALANCE_MISMATCH: ${balanceViolations.length} violations`);
    allViolations.push(...balanceViolations);
    
    // Windowed rules
    const structuringViolations = checkStructuring(records);
    console.log(`  STRUCTURING_PATTERN: ${structuringViolations.length} violations`);
    allViolations.push(...structuringViolations);
    
    const velocityViolations = checkSubThresholdVelocity(records);
    console.log(`  SUB_THRESHOLD_VELOCITY: ${velocityViolations.length} violations`);
    allViolations.push(...velocityViolations);
    
    const sarVelocityViolations = checkSarVelocity(records);
    console.log(`  SAR_VELOCITY: ${sarVelocityViolations.length} violations`);
    allViolations.push(...sarVelocityViolations);
    
    const aggregationViolations = checkCtrAggregation(records);
    console.log(`  CTR_AGGREGATION: ${aggregationViolations.length} violations`);
    allViolations.push(...aggregationViolations);
    
    const roundViolations = checkRoundAmount(records);
    console.log(`  ROUND_AMOUNT_PATTERN: ${roundViolations.length} violations`);
    allViolations.push(...roundViolations);
    
    console.log(`\nTotal violations: ${allViolations.length}`);
    
    return allViolations;
}

function evaluate(violations: Violation[], records: NormalizedRecord[]): EvaluationResult {
    // Get all flagged indices (unique)
    const flaggedIndices = new Set<number>();
    const ruleBreakdown: Record<string, { detected: number; fraud_in_detected: number }> = {};
    
    for (const v of violations) {
        for (const idx of v.record_indices) {
            flaggedIndices.add(idx);
        }
        
        if (!ruleBreakdown[v.rule_id]) {
            ruleBreakdown[v.rule_id] = { detected: 0, fraud_in_detected: 0 };
        }
        ruleBreakdown[v.rule_id].detected += v.record_indices.length;
        
        // Count fraud in this rule's detections
        for (const idx of v.record_indices) {
            if (records[idx].isFraud === 1) {
                ruleBreakdown[v.rule_id].fraud_in_detected++;
            }
        }
    }
    
    // Get ground truth fraud indices
    const fraudIndices = new Set<number>();
    records.forEach((r, idx) => {
        if (r.isFraud === 1) fraudIndices.add(idx);
    });
    
    // Calculate confusion matrix
    let tp = 0; // Correctly detected fraud
    let fp = 0; // Flagged but not fraud
    let fn = 0; // Fraud but not flagged
    let tn = 0; // Not fraud and not flagged
    
    for (let i = 0; i < records.length; i++) {
        const isFlagged = flaggedIndices.has(i);
        const isFraud = records[i].isFraud === 1;
        
        if (isFlagged && isFraud) tp++;
        else if (isFlagged && !isFraud) fp++;
        else if (!isFlagged && isFraud) fn++;
        else tn++;
    }
    
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const accuracy = (tp + tn) / records.length;
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
    
    return {
        true_positives: tp,
        false_positives: fp,
        true_negatives: tn,
        false_negatives: fn,
        precision,
        recall,
        f1_score: f1,
        accuracy,
        total_transactions: records.length,
        actual_fraud_count: fraudIndices.size,
        detected_count: flaggedIndices.size,
        detection_rate: recall,
        false_positive_rate: fpr,
        rule_breakdown: ruleBreakdown,
    };
}

function printResults(result: EvaluationResult): void {
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('                    EVALUATION RESULTS                      ');
    console.log('═'.repeat(60));
    console.log('\n');
    
    console.log('📊 Dataset Statistics');
    console.log('─'.repeat(40));
    console.log(`  Total transactions:     ${result.total_transactions.toLocaleString()}`);
    console.log(`  Actual fraud cases:     ${result.actual_fraud_count.toLocaleString()}`);
    console.log(`  Fraud rate:             ${((result.actual_fraud_count / result.total_transactions) * 100).toFixed(3)}%`);
    console.log(`  System flagged:         ${result.detected_count.toLocaleString()}`);
    console.log('\n');
    
    console.log('📈 Performance Metrics');
    console.log('─'.repeat(40));
    console.log(`  Precision:              ${(result.precision * 100).toFixed(2)}%`);
    console.log(`  Recall:                 ${(result.recall * 100).toFixed(2)}%`);
    console.log(`  F1 Score:               ${(result.f1_score * 100).toFixed(2)}%`);
    console.log(`  Accuracy:               ${(result.accuracy * 100).toFixed(4)}%`);
    console.log('\n');
    
    console.log('📋 Confusion Matrix');
    console.log('─'.repeat(40));
    console.log(`  True Positives (TP):    ${result.true_positives.toLocaleString()}`);
    console.log(`  False Positives (FP):   ${result.false_positives.toLocaleString()}`);
    console.log(`  True Negatives (TN):    ${result.true_negatives.toLocaleString()}`);
    console.log(`  False Negatives (FN):   ${result.false_negatives.toLocaleString()}`);
    console.log('\n');
    
    console.log('🔍 Rule Breakdown (detected / fraud in detected)');
    console.log('─'.repeat(40));
    const sortedRules = Object.entries(result.rule_breakdown)
        .sort((a, b) => b[1].detected - a[1].detected);
    
    for (const [ruleId, stats] of sortedRules) {
        const pct = stats.detected > 0 
            ? ((stats.fraud_in_detected / stats.detected) * 100).toFixed(1) 
            : '0.0';
        console.log(`  ${ruleId.padEnd(25)} ${stats.detected.toString().padStart(6)} / ${stats.fraud_in_detected.toString().padStart(6)} (${pct}%)`);
    }
    console.log('\n');
    
    console.log('💡 Interpretation');
    console.log('─'.repeat(40));
    if (result.precision > 0.7 && result.recall > 0.7) {
        console.log('  ✅ Strong overall performance');
    } else if (result.precision > 0.5 || result.recall > 0.5) {
        console.log('  ⚠️  Moderate performance - tuning recommended');
    } else {
        console.log('  ❌ Low performance - review rules needed');
    }
    
    if (result.false_positive_rate > 0.1) {
        console.log('  ⚠️  High false positive rate - may cause alert fatigue');
    }
    
    if (result.recall < 0.5) {
        console.log('  ⚠️  Low recall - missing fraud cases');
    }
    
    console.log('\n');
    console.log('═'.repeat(60));
}

function main(): void {
    const args = process.argv.slice(2);
    const csvPath = args[0] || path.join(process.cwd(), 'public/fraud_detection_subset_50k.csv');
    
    console.log('\n🔍 AML Rule Engine Evaluation');
    console.log(`📁 Loading dataset: ${csvPath}\n`);
    
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ File not found: ${csvPath}`);
        process.exit(1);
    }
    
    // Parse and normalize
    const rawRecords = parseCSV(csvPath);
    console.log(`✓ Parsed ${rawRecords.length} records from CSV`);
    
    const records = normalizeRecords(rawRecords);
    console.log(`✓ Normalized records\n`);
    
    // Run rules
    const violations = runAllRules(records);
    
    // Evaluate
    const result = evaluate(violations, records);
    
    // Print results
    printResults(result);
    
    // Save results to JSON
    const outputPath = path.join(process.cwd(), 'scripts/evaluation-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`📄 Results saved to: ${outputPath}\n`);
}

main();
