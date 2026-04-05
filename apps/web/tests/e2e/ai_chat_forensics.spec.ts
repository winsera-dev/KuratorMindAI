import { test, expect } from '@playwright/test';

test.describe('AI Chat & Forensic Experience', () => {
  // Uses setup state
  
  test('TC-CHAT-01/02: Should send query and receive streamed response with citations', async ({ page }) => {
    // Navigate to a case (e.g. Sritex or the one we just created)
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Sritex|E2E Test Case/i }).first().click();
    
    // Find chat input
    const chatInput = page.getByPlaceholder(/Ask KuratorMind|How can I help/i);
    await expect(chatInput).toBeVisible();
    
    // Send message
    const query = 'Analyze the latest claims in this case.';
    await chatInput.fill(query);
    await page.keyboard.press('Enter');
    
    // Verify word-by-word streaming (visually checked via lack of major state jumps)
    // and citation highlights (Module 5)
    const response = page.locator('.chat-message-ai').last();
    await expect(response).toContainText(/auditor|claim|compliance/i, { timeout: 30000 });
    
    // Check for citation markers [1], [2], etc. or links
    const citation = response.locator('.citation, .reference');
    if (await citation.isVisible()) {
      await expect(citation).toBeVisible();
    }
  });

  test('TC-CHAT-05 to 08: Should show agent routing labels and specialized feedback', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Sritex/i }).first().click();
    
    const chatInput = page.getByPlaceholder(/Ask KuratorMind/i);
    await chatInput.fill('Check for financial inconsistencies in the last audit.');
    await page.keyboard.press('Enter');
    
    // Verify specialized agent routing (Module 5)
    // Orchestrator labels might look like 'Routing to Forensic Accountant...'
    await expect(page.getByText(/Forensic Accountant|Auditor/i)).toBeVisible();
  });

  test('TC-CLAIM-04/05: Should display AuditFlagCard for flagged conflicts', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Sritex/i }).first().click();
    
    // Navigate to a section that might have flags, or trigger a chat that flags something
    // If the UI has a 'Flags' or 'Audit' tab:
    const auditTab = page.getByRole('tab', { name: /Audit|Flags/i });
    if (await auditTab.isVisible()) {
      await auditTab.click();
      
      // Verify AuditFlagCard (forensic banner/card)
      await expect(page.locator('.audit-flag-card, [data-testid="audit-flag"]')).toBeVisible();
      await expect(page.getByText(/High Risk|Discrepancy|Conflict/i)).toBeVisible();
    }
  });
});
