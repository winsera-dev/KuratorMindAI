import { test, expect } from '@playwright/test';

test.describe('Report Generation & UX Polish', () => {
  // Uses setup state
  
  test('TC-RPT-01 to 05: Should trigger report, view progress, and download PDF', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText(/Sritex/i).first().click();
    
    // Find 'Reports' tab/link (Outputs in the UI)
    const reportsTab = page.getByRole('button', { name: /Reports|Outputs/i });
    await expect(reportsTab).toBeVisible();
    await reportsTab.click();
    
    // Find a 'New Document' button in one of the templates
    const generateBtn = page.getByRole('button', { name: /New Document/i }).first();
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();
    
    // Verify progress state (Module 8)
    // Progress indicators: 'Generating...', status messages
    await expect(page.getByText(/Generating/i)).toBeVisible();
    // Wait for architect status
    await expect(page.locator('span').filter({ hasText: /Architect|Thinking|Drafting/i })).toBeVisible();
    
    // Wait for completion (refresh results in list)
    // The list should show the new report
    const downloadBtn = page.getByRole('button', { name: /Download PDF/i });
    await expect(downloadBtn.first()).toBeVisible({ timeout: 60000 });
    
    // Trigger and intercept download
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.first().click(),
    ]);
    await expect(download.suggestedFilename()).toMatch(/.*\.pdf/);
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
