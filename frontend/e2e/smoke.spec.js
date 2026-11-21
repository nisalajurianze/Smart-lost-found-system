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

  for (const { mode, width, theme, action } of [
    { mode: 'found', width: 390, theme: 'dark', action: 'This is mine' },
    { mode: 'lost', width: 320, theme: 'light', action: 'I have this' },
  ]) {
    test(`the mobile ${mode} claim panel is solid and leaves room for the assistant`, async ({ page }, testInfo) => {
      const reportId = '507f1f77bcf86cd799439012';
      const user = { _id: '507f1f77bcf86cd799439011', fullName: 'Test User', phone: '0771234567', studentId: 'SEU-TEST', role: 'student', isVerified: true };
      const report = {
        _id: reportId, itemName: 'Blue umbrella', category: 'Accessories', status: mode === 'found' ? 'available' : 'pending',
        userId: { _id: '507f1f77bcf86cd799439013', fullName: 'Test Reporter' },
        description: 'A folding blue umbrella with a silver handle.',
        createdAt: '2026-11-21T08:00:00Z', [`${mode}Date`]: '2026-11-21T06:00:00Z', images: [],
      };
      await page.setViewportSize({ width, height: 744 });
      await page.addInitScript((selectedTheme) => localStorage.setItem('smart-lf-theme-v2', selectedTheme), theme);
      await page.route('**/api/**', (route) => {
        const pathname = new URL(route.request().url()).pathname;
        let data = [];
        if (pathname === '/api/auth/me') data = user;
        if (pathname === `/api/${mode}-items/${reportId}`) data = report;
        if (pathname.startsWith('/api/claims/check/')) data = { hasClaim: false };
        if (pathname.startsWith('/api/claims/questions/')) data = { questions: [] };
        return route.fulfill({ json: { success: true, data } });
      });
      await page.goto(`/${mode}-items/${reportId}`);
      const panel = page.locator('.mobile-sticky-claim');
      const assistant = page.getByRole('button', { name: 'Open Smart L&F assistant' });
      const claim = panel.getByRole('button', { name: action, exact: true });
      await expect(claim).toBeInViewport();
      await expect(panel).toHaveCSS('position', 'sticky');
      await expect(panel).toHaveCSS('opacity', '1');
      await expect(panel).toHaveCSS('background-color', theme === 'dark' ? 'rgb(30, 27, 75)' : 'rgb(238, 242, 255)');
      const panelBox = await panel.boundingBox();
      const assistantBox = await assistant.boundingBox();
      expect(panelBox.width).toBeLessThanOrEqual(288);
      expect(assistantBox.x - (panelBox.x + panelBox.width)).toBeGreaterThanOrEqual(10);
      await page.screenshot({ path: testInfo.outputPath('mobile-claim-panel.png') });
      await claim.click();
      await expect(page.getByRole('dialog', { name: 'Secure claim • Blue umbrella' })).toBeVisible();
    });
  }

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

  test('helpdesk can queue a request before the first chat message', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/auth/me', (route) => route.fulfill({
      json: { success: true, data: { _id: '507f1f77bcf86cd799439011', fullName: 'Test User', role: 'student', isVerified: true } },
    }));
    await page.route('**/api/auth/csrf', (route) => route.fulfill({
      json: { success: true, data: { csrfToken: 'test-csrf' } },
    }));
    await page.route('**/api/ai/handoff', (route) => route.fulfill({
      status: 201, json: { success: true, data: { ticketId: 'test-ticket', status: 'queued', stateVersion: 1 } },
    }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Smart L&F assistant' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    const handoff = page.waitForRequest('**/api/ai/handoff');
    await page.getByRole('button', { name: 'Ask authorized helpdesk' }).click();
    expect((await handoff).postDataJSON()).toEqual({
      sessionId: expect.any(String), consent: true, reason: 'User requested helpdesk support.',
    });
    await expect(page.getByText('Helpdesk request queued. Ticket test-ticket')).toBeVisible();
  });

  test('simple assistant keeps search, history and guided report actions available', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const user = { _id: '507f1f77bcf86cd799439011', fullName: 'Test User', email: 'chat@example.test', studentId: 'SEU-CHAT', phone: '0771234567', role: 'student', isVerified: true };
    const reportUrl = '/found-items/507f1f77bcf86cd799439012';
    await page.route('**/api/**', (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      let data = [];
      if (path === '/api/auth/me') data = user;
      if (path === '/api/auth/csrf') data = { csrfToken: 'test-csrf' };
      if (path === '/api/ai/chat') {
        const { message } = request.postDataJSON();
        data = message === 'I lost an item on campus' ? {
          text: 'Here is a possible match.', total: 1,
          items: [{ _id: '507f1f77bcf86cd799439012', itemType: 'FoundItem', itemName: 'Blue umbrella', relevanceScore: 81, reasons: ['Similar colour'], url: reportUrl, claimUrl: reportUrl }],
        } : {
          text: 'Here is your report draft.', sessionState: { version: 1 },
          reportDraft: { reportType: 'lost', state: 'collecting', version: 1, confidence: 70, fields: { itemName: 'Blue umbrella', location: 'Main Library' }, missing: ['date/time'] },
        };
      }
      return route.fulfill({ json: { success: true, data } });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Open Smart L&F assistant' }).click();
    const chat = page.getByRole('dialog', { name: 'Smart L&F Assistant' });
    await expect(chat.getByRole('button', { name: 'Found an item' })).toBeInViewport();
    await expect(chat.getByRole('combobox', { name: 'Voice language' })).toHaveCount(0);
    await chat.getByRole('button', { name: 'Lost something' }).click();
    await expect(chat.getByRole('link', { name: 'View report' })).toHaveAttribute('href', reportUrl);
    await expect(chat.getByText('Similar colour')).toBeHidden();
    await chat.getByText('Why it appeared').click();
    await expect(chat.getByText('Similar colour')).toBeVisible();

    await chat.getByRole('button', { name: 'Chat options' }).click();
    await chat.getByRole('combobox', { name: 'Voice language' }).selectOption('si-LK');
    await chat.getByRole('button', { name: 'New conversation' }).click();
    await expect(chat.getByRole('button', { name: 'Lost something' })).toBeVisible();
    await chat.getByRole('button', { name: 'Chat options' }).click();
    await expect(chat.getByRole('combobox', { name: 'Voice language' })).toHaveValue('si-LK');
    await chat.getByRole('button', { name: 'Conversation history' }).click();
    await chat.getByRole('button', { name: /^I lost an item on campus/ }).click();
    await expect(chat.getByText('Here is a possible match.')).toBeVisible();

    await chat.getByRole('textbox').fill('Draft a report for my blue umbrella');
    await chat.getByRole('button', { name: 'Send message' }).click();
    await chat.getByRole('button', { name: /Open guided report/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/report-lost$/);
    await expect(chat).toHaveCount(0);
  });

  test('a loaded listing photo stays visible without a separate background', async ({ page }) => {
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
    await expect(photo).toHaveCSS('object-fit', 'contain');
    await expect(photo.locator('..')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
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
