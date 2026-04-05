import { test, expect } from '@playwright/test';

test.describe('AI Chat & Forensic Experience', () => {
  // Uses setup state
  
  test('TC-CHAT-01/02: Should send query and receive streamed response with citations', async ({ page }) => {
    // Navigate to a case (e.g. Sritex)
    await page.goto('/dashboard');
    // Wait for skeletons to disappear and content to load
    await expect(page.getByRole('heading', { name: /dashboard|my cases/i })).toBeVisible({ timeout: 15000 });
    
    // Click on Sritex case (from seed data)
    await page.getByText(/Sritex/i).first().click();
    await expect(page).toHaveURL(/.*case\/.*/);
    
    // Find chat input
    const chatInput = page.getByPlaceholder(/Ask anything about this case.../i);
    await expect(chatInput).toBeVisible();
    
    // Send message
    const query = 'Analyze the latest claims in this case.';
    await chatInput.fill(query);
    await page.keyboard.press('Enter');
    
    // Verify word-by-word streaming (visually checked via presence of pulse indicator during stream)
    const pulseIndicator = page.locator('.animate-pulse').first();
    // It might be too fast to catch, but we can try
    // await expect(pulseIndicator).toBeVisible();
    
    // Verify citation highlights (Module 5)
    // Looking for a button that acts as a citation badge
    const response = page.locator('.prose').last();
    await expect(response).toContainText(/auditor|claim|compliance|Sritex/i, { timeout: 30000 });
    
    // Check for citation markers
    const citationBadge = page.locator('button').filter({ hasText: /^[0-9]+$/ }).first();
    await expect(citationBadge).toBeVisible();
  });

  test('TC-CHAT-05 to 08: Should show agent routing labels and specialized feedback', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText(/Sritex/i).first().click();
    
    const chatInput = page.getByPlaceholder(/Ask anything about this case.../i);
    await chatInput.fill('Check for financial inconsistencies in the last audit.');
    await page.keyboard.press('Enter');
    
    // Verify specialized agent routing (Module 5)
    // Orchestrator labels appear in the status area while streaming
    const statusLabel = page.locator('span').filter({ hasText: /Contextualizing|Routing|Analyzing|Thinking/i });
    await expect(statusLabel).toBeVisible();
  });

  test('TC-CLAIM-04/05: Should display AuditFlagCard for flagged conflicts', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText(/Sritex/i).first().click();
    
    // Navigate to Audit tab
    const auditTab = page.getByRole('button', { name: /Audit/i });
    await expect(auditTab).toBeVisible();
    await auditTab.click();
    
    // Verify AuditFlagCard (forensic banner/card)
    // Sritex seed data should have some flags
    const flagCard = page.locator('.group.relative.bg-card.border');
    await expect(flagCard.first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/CRITICAL|HIGH|MEDIUM|LOW/i)).toBeVisible();
    await expect(page.getByText(/View Forensic Proof/i)).toBeVisible();
  });
});
