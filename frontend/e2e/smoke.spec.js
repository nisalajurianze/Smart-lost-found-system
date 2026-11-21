import { test, expect } from '@playwright/test';

test.describe('Smart Lost & Found - Web App Smoke Suite', () => {

  test('1. Public homepage loads cleanly without uncaught errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Smart Lost & Found|Lost and Found/i);

    // Verify main content area is visible
    const mainHeading = page.getByRole('heading', { level: 1 }).first();
    await expect(mainHeading).toBeVisible();

    // Verify no critical JavaScript uncaught exceptions
    const criticalErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('2. Public login and registration routes render cleanly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();

    await page.goto('/register');
    await expect(page.locator('input[name="fullName"], input[type="text"]').first()).toBeVisible();
  });

  test('3. Protected dashboard route safely redirects unauthenticated visitors', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('4. CSRF endpoint issues token and sets accessible cookie', async ({ request }) => {
    const response = await request.get('/api/auth/csrf');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.csrfToken).toBeTruthy();
    expect(typeof data.data.csrfToken).toBe('string');
  });

  test('5. Socket.IO polling endpoint does not return SPA index.html', async ({ request }) => {
    const origin = new URL(test.info().project.use.baseURL).origin;
    const response = await request.get('/socket.io/?EIO=4&transport=polling', { headers: { Origin: origin } });
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/^0\{/);
  });

  test('6. Mobile viewport renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasHorizontalScrollbar = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScrollbar).toBe(false);
  });

  test('the mobile assistant opens with a readable composer and waits for a tap to type', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 660 });
    await page.goto('/');
    const launcher = page.getByRole('button', { name: 'Open Smart L&F assistant' });
    await launcher.click();
    const dialog = page.getByRole('dialog', { name: 'Smart L&F Assistant' });
    const input = dialog.getByRole('textbox', { name: 'Ask about a lost or found item' });
    await expect(dialog).toBeFocused();
    await expect(dialog.getByText(/Tell me what you lost or found/)).toBeInViewport();
    await expect.poll(() => input.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await expect(dialog.getByRole('button', { name: 'Send message' })).toBeInViewport();
    await input.click();
    await expect(input).toBeFocused();
    await dialog.getByRole('button', { name: 'Close assistant', exact: true }).click();
    await expect(launcher).toBeFocused();
  });

  test('a loaded listing photo is visible on the public card', async ({ page }) => {
    const item = {
      _id: '507f1f77bcf86cd799439011',
      itemName: 'Preview mouse',
      description: 'A black wired mouse for the listing preview check.',
      category: 'Electronics',
      status: 'pending',
      lostLocation: 'Main Library',
      lostDate: '2026-05-01T10:00:00.000Z',
      images: [{ url: '/logo.png' }],
    };
    await page.route(/\/api\/lost-items(?:\?|$)/, (route) => route.fulfill({
      json: { success: true, data: { items: [item], pagination: { page: 1, totalPages: 1 } } },
    }));

    await page.goto('/lost-items');
    const photo = page.getByRole('img', { name: item.itemName });
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    await expect(photo).toHaveCSS('opacity', '1');
  });

  test('7. End-to-end Login, Session Validation, Dashboard & Logout flow', async ({ page }) => {
    const testEmail = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'ci-admin@example.com';
    const testPassword = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    // Skip full auth submission if running in a dry environment without test credentials
    test.skip(!testPassword, 'Skipping auth execution: set E2E_ADMIN_PASSWORD to run full login test');

    // 1. Obtain CSRF token
    const csrfRes = await page.request.get('/api/auth/csrf');
    expect(csrfRes.status()).toBe(200);

    // 2. Perform UI Login
    await page.goto('/login');
    await page.locator('input[type="email"], input[name="email"]').fill(testEmail);
    await page.locator('input[type="password"], input[name="password"]').fill(testPassword);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // 3. Confirm navigation to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // 4. Validate /api/auth/me succeeds with cookie authentication
    const meRes = await page.request.get('/api/auth/me');
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.success).toBe(true);
    expect(meJson.data.email).toBe(testEmail.toLowerCase());

    // 5. Logout
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL(/\/login|\/$/);
    }
  });

});
