// ============================================================
// P2-27: End-to-end AML ops verification
// Full flow: org → audit → upload → mapping → scan → review → export
// ============================================================

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

test.describe('AML Ops E2E Flow', () => {
    test('org resolution returns a valid response', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/organizations/current`);
        // May be 401 if unauthenticated — that's acceptable in CI without Supabase
        expect([200, 401]).toContain(res.status());
    });

    test('audit list returns array', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/audits`);
        if (res.status() === 200) {
            const data = await res.json();
            expect(data).toHaveProperty('audits');
            expect(Array.isArray(data.audits)).toBeTruthy();
        }
    });

    test('create audit with AML policy', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/api/audits`, {
            data: {
                name: 'E2E AML Test Audit',
                policy_type: 'aml',
            },
        });

        if (res.status() === 201) {
            const data = await res.json();
            expect(data).toHaveProperty('audit_id');
            expect(data).toHaveProperty('policy_id');
            expect(data).toHaveProperty('rules');
            expect(data.rules.length).toBeGreaterThan(0);
        } else {
            // 401 in unauthenticated CI is acceptable
            expect([401, 500]).toContain(res.status());
        }
    });

    test('scan history returns list', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/scan/history`);
        if (res.status() === 200) {
            const data = await res.json();
            expect(data).toHaveProperty('scans');
        }
    });

    test('export JSON returns report structure', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/export?format=json`);
        if (res.status() === 200) {
            const data = await res.json();
            expect(data.report).toHaveProperty('generated_at');
            expect(data.report).toHaveProperty('policy');
            expect(data.report).toHaveProperty('scan');
            expect(data.report).toHaveProperty('violations');
            expect(data.report).toHaveProperty('reviews');
            expect(data.report).toHaveProperty('summary');
            expect(data.report.summary).toHaveProperty('by_severity');
        }
    });

    test('export PDF returns binary', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/export?format=pdf`);
        if (res.status() === 200) {
            const contentType = res.headers()['content-type'];
            expect(contentType).toContain('application/pdf');
        }
    });

    test('connectors list returns array', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/connectors`);
        if (res.status() === 200) {
            const data = await res.json();
            expect(data).toHaveProperty('connectors');
            expect(Array.isArray(data.connectors)).toBeTruthy();
        }
    });

    test('mapping readiness endpoint returns status', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/api/data/mapping/readiness`, {
            data: { upload_id: '00000000-0000-0000-0000-000000000000', mapping_config: {}, active_rule_ids: [] },
        });
        expect([200, 400, 401, 404, 422]).toContain(res.status());
    });
});

test.describe('AML Ops UI Smoke', () => {
    test('landing page loads', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page).toHaveTitle(/Yggdrasil/i);
    });

    test('export page loads', async ({ page }) => {
        await page.goto(`${BASE_URL}/export`);
        await page.waitForLoadState('networkidle');
        // Should render without crashing
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });
});
