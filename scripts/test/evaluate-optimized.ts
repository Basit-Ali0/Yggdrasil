#!/usr/bin/env npx tsx
/**
 * Optimized AML Evaluation Script
 * 
 * This version uses tuned rules based on fraud pattern analysis:
 * - Only consider CASH_OUT and TRANSFER transactions
 * - Use combined signals (account emptied + amount threshold)
 * - Remove high-FP rules like BALANCE_MISMATCH
 */

import * as fs from 'fs';
import * as path from 'path';

interface Transaction {
    step: number;
    type: string;
    amount: number;
    account: string;
    recipient: string;
    oldbalanceOrg: number;
    newbalanceOrig: number;
    oldbalanceDest: number;
    newbalanceDest: number;
    isFraud: number;
    rawIndex: number;
}

interface Violation {
    rule_id: string;
    record_indices: number[];
}

interface EvalResult {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
    precision: number;
    recall: number;
    f1_score: number;
    accuracy: number;
    total_transactions: number;
    fraud_count: number;
    detected_count: number;
}

function parseCSV(filePath: string): Transaction[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const records: Transaction[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row: any = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx]?.trim() ?? '';
        });
        
        records.push({
            step: parseFloat(row.step) || 0,
            type: row.type,
            amount: parseFloat(row.amount) || 0,
            account: row.nameOrig,
            recipient: row.nameDest,
            oldbalanceOrg: parseFloat(row.oldbalanceOrg) || 0,
            newbalanceOrig: parseFloat(row.newbalanceOrig) || 0,
            oldbalanceDest: parseFloat(row.oldbalanceDest) || 0,
            newbalanceDest: parseFloat(row.newbalanceDest) || 0,
            isFraud: parseInt(row.isFraud) || 0,
            rawIndex: i - 1,
        });
    }
    
    return records;
}

// ── Optimized Rules ───────────────────────────────────────────

function rule1_AccountEmptied(txns: Transaction[]): Violation[] {
    // Account emptied + CASH_OUT or TRANSFER + amount > 0
    const violations: Violation[] = [];
    
    for (const t of txns) {
        const isCashOutOrTransfer = ['CASH_OUT', 'TRANSFER'].includes(t.type);
        const accountEmptied = t.oldbalanceOrg > 0 && t.newbalanceOrig === 0;
        
        if (isCashOutOrTransfer && accountEmptied && t.amount > 0) {
            violations.push({
                rule_id: 'OPTIMIZED_ACCOUNT_EMPTIED',
                record_indices: [t.rawIndex],
            });
        }
    }
    
    return violations;
}

function rule2_DestWasEmpty(txns: Transaction[]): Violation[] {
    // Transfer to empty account + amount > threshold
    const violations: Violation[] = [];
    
    for (const t of txns) {
        const isCashOutOrTransfer = ['CASH_OUT', 'TRANSFER'].includes(t.type);
        const destWasEmpty = t.oldbalanceDest === 0;
        const significantAmount = t.amount >= 10000;
        
        if (isCashOutOrTransfer && destWasEmpty && significantAmount) {
            violations.push({
                rule_id: 'OPTIMIZED_DEST_EMPTY',
                record_indices: [t.rawIndex],
            });
        }
    }
    
    return violations;
}

function rule3_HighRiskPattern(txns: Transaction[]): Violation[] {
    // Combined: CASH_OUT/TRANSFER + account emptied + dest was empty
    const violations: Violation[] = [];
    
    for (const t of txns) {
        const isCashOutOrTransfer = ['CASH_OUT', 'TRANSFER'].includes(t.type);
        const accountEmptied = t.oldbalanceOrg > 0 && t.newbalanceOrig === 0;
        const destWasEmpty = t.oldbalanceDest === 0;
        
        if (isCashOutOrTransfer && accountEmptied && destWasEmpty) {
            violations.push({
                rule_id: 'OPTIMIZED_HIGH_RISK_PATTERN',
                record_indices: [t.rawIndex],
            });
        }
    }
    
    return violations;
}

function rule4_CTRFiltered(txns: Transaction[]): Violation[] {
    // CTR but only for CASH_OUT/TRANSFER (not DEPOSIT/CASH_IN)
    const violations: Violation[] = [];
    
    for (const t of txns) {
        const isCashOutOrTransfer = ['CASH_OUT', 'TRANSFER'].includes(t.type);
        
        if (isCashOutOrTransfer && t.amount >= 10000) {
            violations.push({
                rule_id: 'OPTIMIZED_CTR',
                record_indices: [t.rawIndex],
            });
        }
    }
    
    return violations;
}

function evaluate(violations: Violation[], txns: Transaction[]): EvalResult {
    const flagged = new Set<number>();
    for (const v of violations) {
        for (const idx of v.record_indices) {
            flagged.add(idx);
        }
    }
    
    const fraudSet = new Set<number>();
    txns.forEach((t, idx) => {
        if (t.isFraud === 1) fraudSet.add(idx);
    });
    
    let tp = 0, fp = 0, fn = 0, tn = 0;
    
    for (let i = 0; i < txns.length; i++) {
        const isFlagged = flagged.has(i);
        const isFraud = txns[i].isFraud === 1;
        
        if (isFlagged && isFraud) tp++;
        else if (isFlagged && !isFraud) fp++;
        else if (!isFlagged && isFraud) fn++;
        else tn++;
    }
    
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    
    return {
        true_positives: tp,
        false_positives: fp,
        true_negatives: tn,
        false_negatives: fn,
        precision,
        recall,
        f1_score: f1,
        accuracy: (tp + tn) / txns.length,
        total_transactions: txns.length,
        fraud_count: fraudSet.size,
        detected_count: flagged.size,
    };
}

function printComparison(results: { name: string; result: EvalResult }[]): void {
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('                    OPTIMIZED RULE COMPARISON                                ');
    console.log('═'.repeat(80));
    console.log('\n');
    
    // Header
    console.log('  Rule Configuration'.padEnd(35) + '| Precision | Recall  | F1 Score | Flagged');
    console.log('  ' + '─'.repeat(75));
    
    for (const { name, result } of results) {
        const prec = (result.precision * 100).toFixed(2).padStart(8) + '%';
        const rec = (result.recall * 100).toFixed(2).padStart(7) + '%';
        const f1 = (result.f1_score * 100).toFixed(2).padStart(8) + '%';
        const flagged = result.detected_count.toLocaleString().padStart(7);
        
        console.log(`  ${name.padEnd(33)}| ${prec}  | ${rec} | ${f1} | ${flagged}`);
    }
    
    // Best configuration detail
    const best = results.reduce((a, b) => 
        b.result.f1_score > a.result.f1_score ? b : a
    );
    
    console.log('\n\n');
    console.log('🏆 Best Configuration: ' + best.name);
    console.log('─'.repeat(80));
    console.log(`  True Positives:  ${best.result.true_positives} (caught ${best.result.true_positives}/${best.result.fraud_count} fraud cases)`);
    console.log(`  False Positives: ${best.result.false_positives.toLocaleString()}`);
    console.log(`  False Negatives: ${best.result.false_negatives} (missed fraud)`);
    console.log(`  True Negatives:  ${best.result.true_negatives.toLocaleString()}`);
    console.log('\n');
    console.log(`  Precision: ${(best.result.precision * 100).toFixed(2)}% - "Of all flagged, how many were real fraud?"`);
    console.log(`  Recall:    ${(best.result.recall * 100).toFixed(2)}% - "Of all real fraud, how many did we catch?"`);
    console.log(`  F1 Score:  ${(best.result.f1_score * 100).toFixed(2)}% - Balanced measure`);
    console.log('\n');
    console.log('═'.repeat(80));
}

function main(): void {
    const csvPath = process.argv[2] || path.join(process.cwd(), 'public/fraud_detection_subset_50k.csv');
    
    console.log('\n🔍 Optimized AML Rule Evaluation');
    console.log(`📁 Loading: ${csvPath}\n`);
    
    const txns = parseCSV(csvPath);
    console.log(`✓ Loaded ${txns.length.toLocaleString()} transactions\n`);
    
    const results: { name: string; result: EvalResult }[] = [];
    
    // Test different rule combinations
    console.log('Testing rule configurations...\n');
    
    // 1. Original rules (baseline)
    const allViolations: Violation[] = [];
    allViolations.push(...rule4_CTRFiltered(txns));
    allViolations.push(...rule1_AccountEmptied(txns));
    allViolations.push(...rule2_DestWasEmpty(txns));
    allViolations.push(...rule3_HighRiskPattern(txns));
    
    // 2. Only HIGH_RISK_PATTERN (most specific)
    const highRiskOnly = rule3_HighRiskPattern(txns);
    results.push({
        name: 'High Risk Pattern Only',
        result: evaluate(highRiskOnly, txns),
    });
    
    // 3. Account Emptied (high recall)
    const accountEmptied = rule1_AccountEmptied(txns);
    results.push({
        name: 'Account Emptied',
        result: evaluate(accountEmptied, txns),
    });
    
    // 4. CTR Filtered only
    const ctrFiltered = rule4_CTRFiltered(txns);
    results.push({
        name: 'CTR Filtered (CASH_OUT/TRANSFER only)',
        result: evaluate(ctrFiltered, txns),
    });
    
    // 5. Dest Empty only
    const destEmpty = rule2_DestWasEmpty(txns);
    results.push({
        name: 'Destination Was Empty',
        result: evaluate(destEmpty, txns),
    });
    
    // 6. Combined: Account Emptied OR Dest Empty
    const combined: Violation[] = [...accountEmptied, ...destEmpty];
    results.push({
        name: 'Account Emptied OR Dest Empty',
        result: evaluate(combined, txns),
    });
    
    // 7. Best precision: HIGH_RISK_PATTERN only
    results.push({
        name: 'CTR + High Risk Pattern',
        result: evaluate([...ctrFiltered, ...highRiskOnly], txns),
    });
    
    // 8. Conservative: only CASH_OUT with account emptied
    const conservative: Violation[] = [];
    for (const t of txns) {
        const isCashOut = t.type === 'CASH_OUT';
        const accountEmptied = t.oldbalanceOrg > 0 && t.newbalanceOrig === 0;
        const destWasEmpty = t.oldbalanceDest === 0;
        
        if (isCashOut && accountEmptied && destWasEmpty && t.amount >= 10000) {
            conservative.push({ rule_id: 'CONSERVATIVE', record_indices: [t.rawIndex] });
        }
    }
    results.push({
        name: 'Conservative (CASH_OUT + all signals)',
        result: evaluate(conservative, txns),
    });
    
    printComparison(results);
}

main();
