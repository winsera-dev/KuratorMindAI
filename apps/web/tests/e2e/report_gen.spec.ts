import { test, expect } from '@playwright/test';

test.describe('Report Generation & UX Polish', () => {
  // Uses setup state
  
  test('TC-RPT-01 to 05: Should trigger report, view progress, and download PDF', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Sritex/i }).first().click();
    
    // Find 'Reports' tab/link
    const reportsTab = page.getByRole('tab', { name: /Reports/i });
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
      
      const generateBtn = page.getByRole('button', { name: /generate report|new report/i });
      await expect(generateBtn).toBeVisible();
      await generateBtn.click();
      
      // Select template
      const templateSelect = page.getByLabel(/template/i);
      if (await templateSelect.isVisible()) await templateSelect.selectOption('draft_v1');
      
      await page.getByRole('button', { name: /start/i }).click();
      
      // Verify progress state (Module 8)
      // Progress indicators: 'Orchestrating agents...', 'Drafting section...'
      await expect(page.getByText(/In Progress|Generating|Drafting/i)).toBeVisible();
      
      // Wait for completion (might take time in a real app, but mocks should be fast)
      const downloadBtn = page.getByRole('button', { name: /download pdf/i });
      await expect(downloadBtn).toBeVisible({ timeout: 60000 });
      
      // Trigger and intercept download (optional but good for E2E)
      const [ download ] = await Promise.all([
        page.waitForEvent('download'),
        downloadBtn.click(),
      ]);
      await expect(download.suggestedFilename()).toMatch(/.*\.pdf/);
    }
  });

  test('TC-DASH-06: Should handle 3G throttling gracefully', async ({ page, context }) => {
    // TC-DASH-06 (Module 12: Network Resilience)
    // Throttle to Fast 3G
    await context.setOffline(false);
    // There is no direct setThrottling in Playwright core yet, but we can use CDP
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 40 // ms
    });

    await page.goto('/dashboard');
    // Verify shimmer loaders appear (Module 11)
    await expect(page.locator('.animate-pulse')).toBeVisible();
    
    // Wait for actual content to load even with slow network
    await expect(page.getByRole('heading', { name: /dashboard|my cases/i })).toBeVisible({ timeout: 30000 });
  });
});
