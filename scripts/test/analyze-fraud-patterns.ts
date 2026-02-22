#!/usr/bin/env npx tsx
/**
 * Fraud Pattern Analysis Script
 * 
 * Analyzes the characteristics of fraudulent transactions in the dataset
 * to help tune the AML rules for better precision.
 */

import * as fs from 'fs';
import * as path from 'path';

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

interface Transaction {
    amount: number;
    type: string;
    step: number;
    oldbalanceOrg: number;
    newbalanceOrig: number;
    oldbalanceDest: number;
    newbalanceDest: number;
    isFraud: number;
    isFlaggedFraud: number;
}

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

function analyze(records: RawRecord[]): void {
    const transactions: Transaction[] = records.map(r => ({
        amount: parseFloat(r.amount) || 0,
        type: r.type,
        step: parseFloat(r.step) || 0,
        oldbalanceOrg: parseFloat(r.oldbalanceOrg) || 0,
        newbalanceOrig: parseFloat(r.newbalanceOrig) || 0,
        oldbalanceDest: parseFloat(r.oldbalanceDest) || 0,
        newbalanceDest: parseFloat(r.newbalanceDest) || 0,
        isFraud: parseInt(r.isFraud) || 0,
        isFlaggedFraud: parseInt(r.isFlaggedFraud) || 0,
    }));
    
    const fraud = transactions.filter(t => t.isFraud === 1);
    const legitimate = transactions.filter(t => t.isFraud === 0);
    
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('               FRAUD PATTERN ANALYSIS                                  ');
    console.log('═'.repeat(70));
    console.log('\n');
    
    // Transaction type breakdown
    console.log('📊 Transaction Types in Fraud vs Legitimate');
    console.log('─'.repeat(70));
    const fraudTypes: Record<string, number> = {};
    const legitTypes: Record<string, number> = {};
    
    for (const t of fraud) {
        fraudTypes[t.type] = (fraudTypes[t.type] || 0) + 1;
    }
    for (const t of legitimate) {
        legitTypes[t.type] = (legitTypes[t.type] || 0) + 1;
    }
    
    console.log('\n  FRAUD transactions:');
    for (const [type, count] of Object.entries(fraudTypes).sort((a, b) => b[1] - a[1])) {
        const pct = ((count / fraud.length) * 100).toFixed(1);
        console.log(`    ${type.padEnd(15)} ${count.toString().padStart(5)} (${pct}%)`);
    }
    
    console.log('\n  LEGITIMATE transactions (sample of key types):');
    for (const type of ['CASH_OUT', 'TRANSFER', 'PAYMENT', 'DEBIT', 'CASH_IN']) {
        const count = legitTypes[type] || 0;
        const pct = ((count / legitimate.length) * 100).toFixed(1);
        console.log(`    ${type.padEnd(15)} ${count.toString().padStart(7)} (${pct}%)`);
    }
    
    // Amount analysis
    console.log('\n\n💰 Amount Distribution');
    console.log('─'.repeat(70));
    
    const fraudAmounts = fraud.map(t => t.amount);
    const legitAmounts = legitimate.map(t => t.amount);
    
    const stats = (arr: number[]) => ({
        min: Math.min(...arr),
        max: Math.max(...arr),
        avg: arr.reduce((a, b) => a + b, 0) / arr.length,
        median: arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)],
    });
    
    const fraudStats = stats(fraudAmounts);
    const legitStats = stats(legitAmounts);
    
    console.log('\n  FRAUD amounts:');
    console.log(`    Min:     $${fraudStats.min.toLocaleString()}`);
    console.log(`    Max:     $${fraudStats.max.toLocaleString()}`);
    console.log(`    Average: $${fraudStats.avg.toFixed(2)}`);
    console.log(`    Median:  $${fraudStats.median.toLocaleString()}`);
    
    console.log('\n  LEGITIMATE amounts:');
    console.log(`    Min:     $${legitStats.min.toLocaleString()}`);
    console.log(`    Max:     $${legitStats.max.toLocaleString()}`);
    console.log(`    Average: $${legitStats.avg.toFixed(2)}`);
    console.log(`    Median:  $${legitStats.median.toLocaleString()}`);
    
    // Fraud by amount buckets
    console.log('\n\n📈 Fraud by Amount Range');
    console.log('─'.repeat(70));
    
    const buckets = [
        { label: '< $1,000', min: 0, max: 1000 },
        { label: '$1K - $5K', min: 1000, max: 5000 },
        { label: '$5K - $10K', min: 5000, max: 10000 },
        { label: '$10K - $50K', min: 10000, max: 50000 },
        { label: '$50K - $100K', min: 50000, max: 100000 },
        { label: '$100K - $500K', min: 100000, max: 500000 },
        { label: '> $500K', min: 500000, max: Infinity },
    ];
    
    console.log('\n  Range          | Fraud | Legit    | Fraud Rate');
    console.log('  ──────────────────────────────────────────────');
    
    for (const bucket of buckets) {
        const fraudInBucket = fraud.filter(t => t.amount >= bucket.min && t.amount < bucket.max).length;
        const legitInBucket = legitimate.filter(t => t.amount >= bucket.min && t.amount < bucket.max).length;
        const total = fraudInBucket + legitInBucket;
        const fraudRate = total > 0 ? (fraudInBucket / total * 100).toFixed(2) : '0.00';
        
        console.log(`  ${bucket.label.padEnd(14)} | ${fraudInBucket.toString().padStart(5)} | ${legitInBucket.toString().padStart(7)} | ${fraudRate}%`);
    }
    
    // Balance analysis (key fraud indicator)
    console.log('\n\n🏦 Balance Analysis (Key Fraud Indicator)');
    console.log('─'.repeat(70));
    
    const emptyDestFraud = fraud.filter(t => t.oldbalanceDest === 0).length;
    const emptyDestLegit = legitimate.filter(t => t.oldbalanceDest === 0).length;
    
    console.log(`\n  Transactions to EMPTY destination accounts:`);
    console.log(`    Fraud:     ${emptyDestFraud} (${((emptyDestFraud / fraud.length) * 100).toFixed(1)}% of fraud)`);
    console.log(`    Legit:     ${emptyDestLegit} (${((emptyDestLegit / legitimate.length) * 100).toFixed(2)}% of legit)`);
    
    const orgEmptiedFraud = fraud.filter(t => t.newbalanceOrig === 0 && t.oldbalanceOrg > 0).length;
    const orgEmptiedLegit = legitimate.filter(t => t.newbalanceOrig === 0 && t.oldbalanceOrg > 0).length;
    
    console.log(`\n  Transactions that EMPTY the origin account:`);
    console.log(`    Fraud:     ${orgEmptiedFraud} (${((orgEmptiedFraud / fraud.length) * 100).toFixed(1)}% of fraud)`);
    console.log(`    Legit:     ${orgEmptiedLegit} (${((orgEmptiedLegit / legitimate.length) * 100).toFixed(2)}% of legit)`);
    
    // Key fraud characteristics
    console.log('\n\n🔑 Key Fraud Characteristics (from this dataset)');
    console.log('─'.repeat(70));
    console.log('\n  1. Fraud ONLY occurs in CASH_OUT and TRANSFER types');
    console.log('     → Filter other transaction types before flagging');
    console.log('\n  2. Most fraud empties the origin account (newbalanceOrig = 0)');
    console.log('     → This is a strong signal for fraud detection');
    console.log('\n  3. Most fraud goes to empty destination accounts');
    console.log('     → oldbalanceDest = 0 is a fraud indicator');
    console.log('\n  4. Fraud amounts vary widely but cluster around account balances');
    
    // Recommended rule adjustments
    console.log('\n\n💡 Recommended Rule Adjustments');
    console.log('─'.repeat(70));
    console.log('\n  For this PaySim-style dataset, consider:');
    console.log('\n  1. CTR_THRESHOLD: Only flag CASH_OUT/TRANSFER types');
    console.log('     (currently flags DEPOSIT/CASH_IN too - high FP)');
    console.log('\n  2. Add a COMBINED_RULE that requires:');
    console.log('     - Transaction type: CASH_OUT or TRANSFER');
    console.log('     - AND (account emptied OR dest was empty)');
    console.log('\n  3. BALANCE_MISMATCH: Consider removing or deprioritizing');
    console.log('     (flags 35K+ transactions, only 4 are fraud)');
    console.log('\n  4. SAR_VELOCITY: Add account behavior context');
    console.log('     (currently flags all high-volume accounts)');
    
    console.log('\n');
    console.log('═'.repeat(70));
}

const csvPath = process.argv[2] || path.join(process.cwd(), 'public/fraud_detection_subset_50k.csv');
const records = parseCSV(csvPath);
analyze(records);
