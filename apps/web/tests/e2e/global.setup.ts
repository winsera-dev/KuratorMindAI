import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.resolve(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // 1. Visit the login page
  await page.goto('/login');

  // 2. Perform authentication (using environment variables for security)
  // These should be set in the environment or .env.test
  const email = process.env.TEST_USER_EMAIL || 'test-user-a@kuratormind.ai';
  const password = process.env.TEST_USER_PASSWORD || 'password123';

  // Note: For initial setup, we assume these exist after database seeding
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();

  // 3. Wait for the dashboard to load (verifying successful login)
  await expect(page).toHaveURL(/.*dashboard/);

  // 4. Save the authentication state
  await page.context().storageState({ path: authFile });
});
