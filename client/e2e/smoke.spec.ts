import { test, expect } from '@playwright/test';

test.describe('Smoke Test - Authentication & Navigation', () => {
  test('landing page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
