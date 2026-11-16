import { test, expect } from 'playwright/test';

test('home page loads and shows the vascular hero', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Dr\. Herlon Moura/);
  expect(page.locator('canvas').first()).toBeVisible();

  await expect(page.locator('[id="contato"]')).toBeVisible();
});
