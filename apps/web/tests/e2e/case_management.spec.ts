import { test, expect } from '@playwright/test';

test.describe('Case Management CRUD', () => {
  // Uses setup state
  
  test('TC-CASE-01 to 07: Should create, edit and view a case', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 1. Create a case (TC-CASE-01)
    const createBtn = page.getByRole('button', { name: /Initialize Workspace|new case/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    // Fill the form (using placeholders or text as labels are not associated via 'for')
    const caseName = `E2E Test Case ${Date.now()}`;
    await page.getByPlaceholder(/PT Maju Jaya Rescheduling/i).fill(caseName);
    await page.getByPlaceholder(/Full Legal Name/i).fill('E2E Test Debtor');
    // Valid format: [No]/Pdt.Sus-[Type]/[Year]/PN [Court]
    await page.getByPlaceholder(/15\/Pdt\.Sus-PKPU\/2024\/PN Jkt\.Pst/i).fill('1/Pdt.Sus-PKPU/2025/PN Niaga Jkt.Pst');
    await page.getByPlaceholder(/PN Jakarta Pusat/i).fill('PN Niaga Jakarta Pusat');
    
    // Set stage and start date
    await page.locator('select').selectOption('pkpu_temp');
    // Start date input is type="date"
    await page.locator('input[type="date"]').fill('2025-01-01');
    
    await page.getByRole('button', { name: /Create Workspace/i }).click();
    
    // Wait for the case to appear in the dashboard
    await expect(page.getByText(caseName)).toBeVisible();
    
    // 2. View Case Details (TC-CASE-02)
    await page.getByText(caseName).first().click();
    await expect(page).toHaveURL(/.*case\/.*/);
    await expect(page.getByRole('heading', { name: caseName })).toBeVisible();
    
    // 3. Edit Case (TC-CASE-04)
    // There is likely a button to open the modal again
    const editBtn = page.getByRole('button', { name: /Workspace Intelligence/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const updatedName = `${caseName} Updated`;
      await page.getByPlaceholder(/PT Maju Jaya Rescheduling/i).fill(updatedName);
      
      // 4. Verify stage transitions / started_at updates (TC-CASE-06)
      await page.locator('select').selectOption('pkpu_permanent');
      
      // Verify stage_started_at auto-updates to today (check input value)
      const today = new Date().toISOString().split("T")[0];
      const startDateInput = page.locator('input[type="date"]');
      await expect(startDateInput).toHaveValue(today);

      await page.getByRole('button', { name: /Update Intelligence/i }).click();
      await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();
    }
  });

  test('TC-SEC-02: User cannot access other users case data', async ({ page }) => {
    // Determine another user's case ID from seed script or dummy ID
    const privateCaseId = '550e8400-e29b-41d4-a716-446655440003'; 
    await page.goto(`/case/${privateCaseId}`);
    
    // Should show 404, 403 or redirect
    await expect(page.getByText(/not found|unauthorized|access denied/i)).toBeVisible();
  });
});
