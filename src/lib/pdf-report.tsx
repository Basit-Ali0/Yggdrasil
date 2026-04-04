// ============================================================
// PDF Report Generator — @react-pdf/renderer
// Pure JS, no browser binary, Vercel/serverless compatible
// ============================================================

import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
    header: { marginBottom: 20 },
    title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
    subtitle: { fontSize: 12, color: '#666', marginBottom: 12 },
    meta: { fontSize: 9, color: '#888', marginBottom: 2 },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 4 },
    row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingVertical: 4 },
    headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 4, marginBottom: 4 },
    col1: { width: '15%' },
    col2: { width: '10%' },
    col3: { width: '15%' },
    col4: { width: '10%' },
    col5: { width: '10%' },
    col6: { width: '40%' },
    bold: { fontFamily: 'Helvetica-Bold' },
    scoreBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 4 },
    scoreValue: { fontSize: 28, fontFamily: 'Helvetica-Bold', marginRight: 12 },
    scoreLabel: { fontSize: 11, color: '#666' },
    summaryGrid: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    summaryCard: { flex: 1, padding: 8, backgroundColor: '#f8f9fa', borderRadius: 4 },
    summaryCardLabel: { fontSize: 8, color: '#888', marginBottom: 2 },
    summaryCardValue: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#aaa' },
});

export interface PdfReportData {
    organization?: { name: string };
    audit?: { name: string };
    policy: { name: string; type: string };
    scan: {
        id: string;
        compliance_score: number;
        record_count: number;
        violation_count: number;
        created_at: string;
        completed_at?: string;
    };
    violations: Array<{
        rule_id: string;
        rule_name: string;
        severity: string;
        account?: string;
        amount?: number;
        status: string;
        explanation?: string;
    }>;
    reviews: {
        total: number;
        approved: number;
        false_positive: number;
        disputed: number;
        pending: number;
    };
    summary: {
        by_severity: Record<string, number>;
    };
    generated_at: string;
}

function severityColor(s: string): string {
    switch (s.toUpperCase()) {
        case 'CRITICAL': return '#dc2626';
        case 'HIGH': return '#ea580c';
        case 'MEDIUM': return '#ca8a04';
        default: return '#666';
    }
}

function ComplianceReport({ data }: { data: PdfReportData }) {
    const score = data.scan.compliance_score ?? 0;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>Compliance Scan Report</Text>
                    <Text style={styles.subtitle}>
                        {data.organization?.name ? `${data.organization.name} — ` : ''}
                        {data.audit?.name ?? 'Scan Report'}
                    </Text>
                    <Text style={styles.meta}>Policy: {data.policy.name} ({data.policy.type})</Text>
                    <Text style={styles.meta}>Scan ID: {data.scan.id.slice(0, 8)}...</Text>
                    <Text style={styles.meta}>
                        Scanned: {new Date(data.scan.created_at).toLocaleString()}
                        {data.scan.completed_at ? ` — Completed: ${new Date(data.scan.completed_at).toLocaleString()}` : ''}
                    </Text>
                    <Text style={styles.meta}>Generated: {new Date(data.generated_at).toLocaleString()}</Text>
                </View>

                {/* Score */}
                <View style={styles.scoreBox}>
                    <Text style={styles.scoreValue}>{score.toFixed(1)}%</Text>
                    <View>
                        <Text style={styles.scoreLabel}>Compliance Score</Text>
                        <Text style={styles.meta}>
                            {data.scan.record_count.toLocaleString()} records scanned — {data.scan.violation_count} violations
                        </Text>
                    </View>
                </View>

                {/* Summary */}
                <View style={styles.summaryGrid}>
                    {Object.entries(data.summary.by_severity).map(([severity, count]) => (
                        <View key={severity} style={styles.summaryCard}>
                            <Text style={styles.summaryCardLabel}>{severity}</Text>
                            <Text style={[styles.summaryCardValue, { color: severityColor(severity) }]}>
                                {count}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Review Status */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Review Status</Text>
                    <Text style={styles.meta}>
                        Reviewed: {data.reviews.total - data.reviews.pending} of {data.reviews.total} |
                        Approved: {data.reviews.approved} | False Positive: {data.reviews.false_positive} |
                        Disputed: {data.reviews.disputed} | Pending: {data.reviews.pending}
                    </Text>
                </View>

                {/* Violations Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Violations ({data.violations.length})</Text>
                    <View style={styles.headerRow}>
                        <Text style={[styles.col1, styles.bold]}>Rule</Text>
                        <Text style={[styles.col2, styles.bold]}>Severity</Text>
                        <Text style={[styles.col3, styles.bold]}>Account</Text>
                        <Text style={[styles.col4, styles.bold]}>Amount</Text>
                        <Text style={[styles.col5, styles.bold]}>Status</Text>
                        <Text style={[styles.col6, styles.bold]}>Explanation</Text>
                    </View>
                    {data.violations.slice(0, 100).map((v, i) => (
                        <View key={i} style={styles.row}>
                            <Text style={styles.col1}>{v.rule_id}</Text>
                            <Text style={[styles.col2, { color: severityColor(v.severity) }]}>{v.severity}</Text>
                            <Text style={styles.col3}>{v.account ?? '-'}</Text>
                            <Text style={styles.col4}>{v.amount != null ? `$${Number(v.amount).toLocaleString()}` : '-'}</Text>
                            <Text style={styles.col5}>{v.status}</Text>
                            <Text style={styles.col6}>{(v.explanation ?? '').slice(0, 120)}</Text>
                        </View>
                    ))}
                    {data.violations.length > 100 && (
                        <Text style={styles.meta}>... and {data.violations.length - 100} more violations (see JSON export for full list)</Text>
                    )}
                </View>

                <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Generated by Yggdrasil — Page ${pageNumber} of ${totalPages}`} fixed />
            </Page>
        </Document>
    );
}

export async function generatePdfBuffer(data: PdfReportData): Promise<ArrayBuffer> {
    const buf = await renderToBuffer(<ComplianceReport data={data} />);
    return (buf.buffer as ArrayBuffer).slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
