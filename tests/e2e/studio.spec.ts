import { test, expect } from 'playwright/test';

test('studio home loads with the script intake call to action', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Shortcraft Studio/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every story deserves a scene');
  await expect(page.getByRole('link', { name: /Start a new video/ })).toBeVisible();
});

test('script intake form creates a project and lands on the shot plan', async ({ page }) => {
  await page.goto('/script/new');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Start with what you want to say');
  const title = `E2E Film ${Date.now()}`;
  await page.getByLabel('Project title').fill(title);
  await page.getByLabel('Script / voiceover text').fill('A fly buzzes past your face. You blink. It is gone.');
  await page.getByRole('button', { name: /Create project/ }).click();

  await expect(page).toHaveURL(/\/story\/e2e-film-/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
  await expect(page.locator('.shot-row')).toHaveCount(3);
});
