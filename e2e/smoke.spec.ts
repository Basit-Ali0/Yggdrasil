import { test, expect } from '@playwright/test';

test.describe('public shell', () => {
    test('landing page shows product name and primary CTA', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1 })).toContainText(/Policy/i);
        await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
    });

    test('login page renders sign-in form', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByText('Sign In').first()).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
    });
});
