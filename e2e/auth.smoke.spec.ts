import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }));
});

test.describe('imsop-app auth smoke', () => {
  test('auth routes are reachable', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.getByText(/welcome to imsop/i)).toBeVisible();

    await page.getByRole('button', { name: /forgot password\?/i }).click();
    await expect(page).toHaveURL(/#\/forgot-password/);
    await expect(page.getByText(/forgot password/i)).toBeVisible();

    await page.goto('/#/register');
    await expect(page.getByText(/create an account/i)).toBeVisible();
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/#\/login/);
  });

  test('demo login reaches dashboard and can navigate', async ({ page }) => {
    await page.goto('/#/login');

    await expect(page.getByText(/demo accounts/i)).toBeVisible();
    await page.getByRole('button', { name: /admin/i }).first().click();
    await page.getByRole('button', { name: /^sign in$/i }).first().click();

    await expect(page.getByRole('heading', { name: /operational overview/i })).toBeVisible();
    await expect(page.getByTitle(/global activity map powered by openstreetmap/i)).toBeVisible();

    if ((page.viewportSize()?.width ?? 1024) < 768) {
      await page.getByRole('button', { name: /open navigation menu/i }).click();
      await page.getByRole('link', { name: /operations/i }).last().click();
    } else {
      await page.getByRole('link', { name: /operations/i }).first().click();
    }
    await expect(page).toHaveURL(/#\/operations/);
    await expect(page.getByText(/operations center/i)).toBeVisible();
  });
});
