import { expect, Page, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }));
});

const accounts = {
  admin: { button: /admin/i, email: 'admin@imsop.io' },
  engineer: { button: /engineer/i, email: 'engineer@imsop.io' },
  analyst: { button: /analyst/i, email: 'analyst@imsop.io' },
  demo: { button: /^demo$/i, email: 'demo@imsop.io' },
} as const;

async function login(page: Page, account: keyof typeof accounts) {
  await page.goto('/#/login');
  await page.getByRole('button', { name: accounts[account].button }).first().click();
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('heading', { name: /operational overview/i })).toBeVisible();
}

test.describe('demo role authorization', () => {
  for (const role of Object.keys(accounts) as Array<keyof typeof accounts>) {
    test(`${role} demo account authenticates with the correct identity`, async ({ page }) => {
      await login(page, role);
      await page.goto('/#/profile');
      await expect(page.getByLabel('Email Address')).toHaveValue(accounts[role].email);
      await expect(page.getByLabel('Role')).toHaveValue(role === 'demo' ? 'user' : role);
    });
  }

  test('admin can access every operational area', async ({ page }) => {
    await login(page, 'admin');
    for (const [path, heading] of [
      ['/operations', /operations center/i], ['/analytics', /analytics & intelligence/i],
      ['/infrastructure', /system health/i], ['/intelligence', /operational intelligence/i],
      ['/assistant', /ai assistant/i], ['/settings', /^settings$/i], ['/profile', /^profile$/i],
    ] as const) {
      await page.goto(`/#${path}`);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('engineer and analyst permissions are enforced on direct routes', async ({ page }) => {
    await login(page, 'engineer');
    await page.goto('/#/infrastructure');
    await expect(page.getByRole('heading', { name: /system health/i })).toBeVisible();
    await page.goto('/#/analytics');
    await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await login(page, 'analyst');
    await page.goto('/#/analytics');
    await expect(page.getByRole('heading', { name: /analytics & intelligence/i })).toBeVisible();
    await page.goto('/#/infrastructure');
    await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
  });

  test('standard demo user is denied privileged routes', async ({ page }) => {
    await login(page, 'demo');
    for (const path of ['/analytics', '/infrastructure', '/intelligence']) {
      await page.goto(`/#${path}`);
      await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
    }
  });
});

test.describe('end-to-end feature flows', () => {
  test.beforeEach(async ({ page }) => login(page, 'admin'));

  test('operations search, map fallback, and CSV export work', async ({ page }) => {
    await page.goto('/#/operations');
    await expect(page.getByText('Demo logistics data')).toBeVisible();
    await expect(page.getByTitle(/global activity map powered by openstreetmap/i)).toBeVisible();
    await page.getByPlaceholder(/search shipments/i).fill('SHP-8829');
    await expect(page.getByText('SHP-8829')).toBeVisible();
    await expect(page.getByText('SHP-9921')).toBeHidden();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /^export$/i }).click();
    await page.getByRole('menuitem', { name: /export as csv/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^shipments-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('assistant accepts a query and returns an operational response', async ({ page }) => {
    await page.goto('/#/assistant');
    const prompt = 'Check shipment SHP-8829';
    await page.getByPlaceholder(/ask about shipments/i).fill(prompt);
    await page.getByPlaceholder(/ask about shipments/i).press('Enter');
    await expect(page.getByText(prompt)).toBeVisible();
    await expect(page.getByText(/analyzed|weather patterns|bottleneck|demand forecast/i)).toBeVisible({ timeout: 5000 });
  });

  test('theme preference and profile changes persist', async ({ page }) => {
    await page.goto('/#/settings');
    await page.getByRole('button', { name: /use light theme/i }).click();
    await expect(page.locator('html')).toHaveClass(/light/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/light/);

    await page.goto('/#/profile');
    await page.getByLabel('Full Name').fill('Admin Demo Updated');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/name updated successfully/i)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Full Name')).toHaveValue('Admin Demo Updated');
  });

  test('demo password flow validates and completes, then logout ends the session', async ({ page }) => {
    await page.goto('/#/profile');
    await page.getByRole('button', { name: /change password/i }).first().click();
    await page.getByLabel('Current Password').fill('admin123');
    await page.getByLabel('New Password', { exact: true }).fill('new-demo-password');
    await page.getByLabel('Confirm New Password').fill('new-demo-password');
    await page.getByRole('button', { name: /change password/i }).last().click();
    await expect(page.getByText(/password changed successfully/i)).toBeVisible();
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page.getByText(/welcome to imsop/i)).toBeVisible();
  });

  test('unknown routes render the not-found recovery screen', async ({ page }) => {
    await page.goto('/#/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await page.getByRole('button', { name: /go home/i }).click();
    await expect(page.getByRole('heading', { name: /operational overview/i })).toBeVisible();
  });
});

test('invalid demo credentials are rejected without creating a session', async ({ page }) => {
  await page.goto('/#/login');
  await page.getByLabel('Email').fill('admin@imsop.io');
  await page.getByLabel('Password').fill('incorrect-password');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/#\/login/);
});
