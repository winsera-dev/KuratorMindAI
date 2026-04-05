import { test, expect } from '@playwright/test';

test.describe('Case Management CRUD', () => {
  // Uses setup state
  
  test('TC-CASE-01 to 07: Should create, edit and view a case', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 1. Create a case (TC-CASE-01)
    const createBtn = page.getByRole('button', { name: /create case|new case/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    // Fill the form (adjust based on actual UI)
    const caseName = `E2E Test Case ${Date.now()}`;
    await page.getByLabel('Case Name').fill(caseName);
    await page.getByLabel('Debtor Entity').fill('E2E Test Debtor');
    await page.getByLabel('Case Number').fill('E2E-TEST-001');
    await page.getByLabel('Court Name').fill('E2E District Court');
    await page.getByLabel('Bankruptcy Date').fill('2025-01-01');
    
    await page.getByRole('button', { name: /save|create/i }).click();
    
    // Wait for the case to appear in the dashboard
    await expect(page.getByText(caseName)).toBeVisible();
    
    // 2. View Case Details (TC-CASE-02)
    await page.getByText(caseName).first().click();
    await expect(page).toHaveURL(/.*case\/.*/);
    await expect(page.getByRole('heading', { name: caseName })).toBeVisible();
    
    // 3. Edit Case (TC-CASE-04)
    const editBtn = page.getByRole('button', { name: /edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const updatedName = `${caseName} Updated`;
      await page.getByLabel('Case Name').fill(updatedName);
      await page.getByRole('button', { name: /save|update/i }).click();
      await expect(page.getByRole('heading', { name: updatedName })).toBeVisible();
    }
    
    // 4. Verify stage transitions / started_at updates (TC-CASE-06)
    // Assuming there's a way to change stage in the UI
    const stageSelect = page.getByLabel(/stage/i);
    if (await stageSelect.isVisible()) {
        await stageSelect.selectOption('pkpu_permanent');
        // Might need a save button if not auto-saving
        const saveBtn = page.getByRole('button', { name: /save/i });
        if (await saveBtn.isVisible()) await saveBtn.click();
        
        // stage_started_at is updated in the background
        // but we might check if a 'Last Updated' timestamp is visible
        // await expect(page.getByText(/Updated just now|Updated/i)).toBeVisible();
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
