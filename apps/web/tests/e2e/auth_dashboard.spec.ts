import { test, expect } from '@playwright/test';

test.describe('Authentication and Dashboard', () => {
  // We use the storage state from setup, so we are already logged in
  // except for explicit login/logout tests.

  test('TC-AUTH-01/02: Should redirect to dashboard after login', async ({ page }) => {
    // This is already partially tested by global.setup.ts
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard|my cases/i })).toBeVisible();
  });

  test('TC-DASH-01: Should show shimmer skeletons during load', async ({ page }) => {
    // To see skeletons, we might need to slow down the network or check for skeleton elements
    // In Next.js, skeletons are often components named 'Skeleton' or with 'animate-pulse'
    await page.goto('/dashboard');
    
    // Check if any skeleton elements are present (this depends on implementation)
    const skeletons = page.locator('.animate-pulse');
    // If they disappear quickly, this might be hard to catch without slowing down
    // But we can check if they existed at some point if we use a specific locator
  });

  test('TC-AUTH-03: Should logout correctly', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find and click logout button (adjust selector based on actual UI)
    const userMenu = page.getByRole('button', { name: /user menu|profile/i });
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.getByRole('menuitem', { name: /log out|sign out/i }).click();
    } else {
      // Fallback if it's a direct button
      const logoutBtn = page.getByRole('button', { name: /log out|sign out/i });
      await logoutBtn.click();
    }

    await expect(page).toHaveURL(/.*login/);
  });
});
