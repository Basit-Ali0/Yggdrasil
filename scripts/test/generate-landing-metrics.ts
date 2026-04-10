#!/usr/bin/env npx tsx
/**
 * Generate Landing Page Metrics
 * 
 * This script runs the optimized rule evaluation and generates
 * metrics suitable for displaying on the landing page.
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
    isFlaggedFraud: number;
    rawIndex: number;
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
            isFlaggedFraud: parseInt(row.isFlaggedFraud) || 0,
            rawIndex: i - 1,
        });
    }
    
    return records;
}

// Optimized rule: CASH_OUT or TRANSFER + account emptied + dest was empty
function optimizedRule(txns: Transaction[]): Set<number> {
    const flagged = new Set<number>();
    
    for (const t of txns) {
        const isCashOutOrTransfer = ['CASH_OUT', 'TRANSFER'].includes(t.type);
        const accountEmptied = t.oldbalanceOrg > 0 && t.newbalanceOrig === 0;
        const destWasEmpty = t.oldbalanceDest === 0;
        
        // High-risk pattern (optimized)
        if (isCashOutOrTransfer && accountEmptied && destWasEmpty) {
            flagged.add(t.rawIndex);
        }
        
        // Also flag high-value CASH_OUT with account emptied
        if (t.type === 'CASH_OUT' && accountEmptied && t.amount >= 10000) {
            flagged.add(t.rawIndex);
        }
    }
    
    return flagged;
}

function main(): void {
    const csvPath = path.join(process.cwd(), 'public/fraud_detection_subset_50k.csv');
    const txns = parseCSV(csvPath);
    
    const flagged = optimizedRule(txns);
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
    
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    const f1 = 2 * precision * recall / (precision + recall);
    
    const metrics = {
        // Core metrics
        precision: Math.round(precision * 1000) / 10, // e.g. 4.2%
        recall: Math.round(recall * 1000) / 10,       // e.g. 91.0%
        f1_score: Math.round(f1 * 1000) / 10,        // e.g. 8.0%
        
        // Detection stats
        fraud_detected: tp,
        total_fraud: fraudSet.size,
        detection_rate: Math.round((tp / fraudSet.size) * 1000) / 10, // e.g. 91.0%
        
        // Dataset info
        dataset: 'PaySim Fraud Detection Dataset',
        total_transactions: txns.length,
        
        // For display
        display_metrics: {
            primary: 'detection_rate',  // Use detection rate as hero metric
            secondary: ['precision', 'recall'],
        },
        
        // Confusion matrix
        confusion_matrix: { tp, fp, fn, tn },
        
        // Timestamp
        generated_at: new Date().toISOString(),
    };
    
    // Write to file
    const outputPath = path.join(process.cwd(), 'src/lib/evaluation-metrics.json');
    fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
    
    console.log('\n📊 Landing Page Metrics Generated');
    console.log('─'.repeat(50));
    console.log(`  Dataset:         ${metrics.dataset}`);
    console.log(`  Transactions:    ${metrics.total_transactions.toLocaleString()}`);
    console.log(`  Fraud Cases:     ${metrics.total_fraud}`);
    console.log('\n  Detection Rate:  ' + metrics.detection_rate + '%');
    console.log('  Precision:       ' + metrics.precision + '%');
    console.log('  Recall:          ' + metrics.recall + '%');
    console.log('  F1 Score:        ' + metrics.f1_score + '%');
    console.log('\n  TP: ' + tp + '  |  FP: ' + fp.toLocaleString());
    console.log('  FN: ' + fn + '  |  TN: ' + tn.toLocaleString());
    console.log('\n✅ Written to: ' + outputPath);
    console.log('\n');
}

main();
