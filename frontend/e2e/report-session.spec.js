import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

if (process.env.PLAYWRIGHT_CHANNEL) test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

const user = { _id: 'session-test-user', fullName: 'Session Test', email: 'session@example.test', phone: '0771234567', studentId: 'SEU-2026-TEST', role: 'student', isVerified: true };

const setupReport = async (page, { refreshSucceeds, providerUnavailable = false, mode = 'lost', completeReport = false }) => {
  const requests = { uploads: 0, refreshes: 0, multipartBodies: [], uploadUrls: [], submissions: [], categoryWrites: 0 };
  if (completeReport) {
    await page.addInitScript(() => {
      const createBitmap = window.createImageBitmap.bind(window);
      const ready = new Promise((resolve) => { window.finishPhotoPreparation = resolve; });
      window.createImageBitmap = async (...args) => {
        await ready;
        return createBitmap(...args);
      };
    });
  }
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const reply = (status, data, message = '') => route.fulfill({ status, json: { success: status === 200, data, message } });
    if (pathname === '/api/auth/me') return reply(200, user);
    if (pathname === '/api/auth/csrf') return reply(200, { csrfToken: 'test-csrf' });
    if (pathname === '/api/auth/refresh-token') {
      requests.refreshes += 1;
      return reply(refreshSucceeds ? 200 : 401, {}, 'Session expired');
    }
    if (pathname === '/api/ai/suggest-details') {
      requests.uploads += 1;
      requests.uploadUrls.push(request.url());
      requests.multipartBodies.push(request.postDataBuffer());
      if (requests.uploads === 1) {
        if (providerUnavailable) return reply(503, {}, 'AI image suggestions are temporarily unavailable.');
        if (!completeReport) return reply(401, {}, 'Access token expired.');
      }
      return reply(200, { isSpam: false, isItemPhoto: true, itemName: 'Red striped bag', category: 'Bags', description: 'A red bag with dark stripes.', moderationDecision: 'allow', privacyWarnings: [], redactionRegions: [] });
    }
    if (pathname === '/api/categories') return reply(200, [{ _id: 'cat-bags', name: 'Bags', icon: '🎒' }]);
    if (pathname === '/api/categories/report-auto-create') {
      requests.categoryWrites += 1;
      return reply(503, {}, 'Category lookup is temporarily unavailable.');
    }
    if (pathname === '/api/ai/report/assess') return reply(200, { quality: { score: 100, suggestions: [] }, duplicates: [] });
    if (pathname === `/api/${mode}-items` && request.method() === 'POST') {
      const form = await new globalThis.Response(request.postDataBuffer(), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
      requests.submissions.push(form);
      return reply(200, { _id: 'submitted-report', itemName: 'Red striped bag' });
    }
    return reply(200, []);
  });
  await page.goto(`/dashboard/report-${mode}`);
  await expect(page.locator('#image-upload-input')).toBeAttached();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(0, 0, 800, 800);
    for (let y = 100; y < 700; y += 40) {
      ctx.fillStyle = y % 80 === 20 ? '#dc2626' : '#202020';
      ctx.fillRect(160, y, 480, 40);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#image-upload-input').setInputFiles({ name: 'bag.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  return requests;
};

test('expired upload session refreshes once and retries the image successfully', async ({ page }) => {
  const requests = await setupReport(page, { refreshSucceeds: true });
  await expect(page.locator('#ai-suggestion-title')).toBeVisible();
  await expect(page.getByText('Red striped bag', { exact: true })).toBeVisible();
  expect(requests.refreshes).toBe(1);
  expect(requests.uploads).toBe(2);
  expect(requests.uploadUrls).toEqual(Array(2).fill(`${new URL(page.url()).origin}/api/ai/suggest-details`));
  const imageParts = requests.multipartBodies.map((body) => {
    expect(body.toString()).toContain('name="image"');
    expect(body.toString()).toContain('Content-Type: image/png');
    return body.subarray(body.indexOf('\r\n\r\n') + 4, body.lastIndexOf('\r\n--'));
  });
  expect(imageParts[0].length).toBeGreaterThan(100);
  expect(imageParts[1].equals(imageParts[0])).toBe(true);
  await expect(page).toHaveURL(/\/dashboard\/report-lost$/);
});

test('failed upload session refresh returns the protected report to login', async ({ page }) => {
  const requests = await setupReport(page, { refreshSucceeds: false });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect(requests.refreshes).toBe(1);
  expect(requests.uploads).toBe(1);
});

test('provider outage keeps the photo in the draft and requires a successful retry', async ({ page }) => {
  const requests = await setupReport(page, { providerUnavailable: true });
  const retry = page.getByRole('button', { name: 'Retry photo check' });
  await expect(retry).toBeVisible();
  await expect(page.getByRole('img', { name: /Preview 1/i })).toBeVisible();
  await expect(page.getByText(/Preparing images/)).toHaveCount(0);
  await expect(page.locator('#ai-suggestion-title')).toHaveCount(0);
  await expect(page.locator('[aria-labelledby="image-privacy-review-title"] button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#photo-step-title')).toBeVisible();
  await page.getByRole('alert', { name: 'Fix these fields' }).getByRole('button', { name: /Photo check is temporarily unavailable/ }).click();
  await expect(retry).toBeFocused();
  expect(requests.uploads).toBe(1);
  expect(requests.refreshes).toBe(0);
  await retry.click();
  await expect(page.locator('#ai-suggestion-title')).toBeVisible();
  expect(requests.uploads).toBe(2);
  expect(requests.multipartBodies[1].toString()).toContain('filename="bag.png"');
});

for (const mode of ['lost', 'found']) {
  test(`${mode} report submits the typed category and selected photo on the first attempt`, async ({ page }) => {
    const requests = await setupReport(page, { mode, completeReport: true });
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    const steps = page.getByRole('navigation', { name: 'Report progress' });
    const photoStep = steps.getByRole('button', { name: /Photo/ });
    const detailsStep = steps.getByRole('button', { name: /Item details/ });
    const locationStep = steps.getByRole('button', { name: /Location & time/ });
    const reviewStep = steps.getByRole('button', { name: /Privacy & review/ });
    await expect(page.getByText(/Preparing images/)).toBeVisible();
    await expect(continueButton).toBeDisabled();
    await expect(locationStep).toBeDisabled();
    expect(requests.uploads).toBe(0);
    await page.evaluate(() => window.finishPhotoPreparation());
    await expect(page.locator('#ai-suggestion-title')).toBeVisible();
    const image = page.getByRole('img', { name: /Preview 1/i });
    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    const suggestions = page.getByRole('region', { name: 'Review AI suggestions' });
    const applyAll = suggestions.getByRole('button', { name: 'Apply all suggestions' });
    const bulkAction = await applyAll.boundingBox();
    const firstSuggestion = await suggestions.getByText('Red striped bag', { exact: true }).boundingBox();
    expect(bulkAction.y + bulkAction.height).toBeLessThan(firstSuggestion.y);
    await applyAll.click();
    await locationStep.click();
    await page.locator('input[name="location"]').fill('SEUSL Main Entrance');
    await page.locator('input[name="date"]').fill('2025-09-08T03:21');
    await detailsStep.click();
    await expect(page.locator('input[name="itemName"]')).toHaveValue('Red striped bag');
    await expect(page.locator('textarea[name="description"]')).toHaveValue('A red bag with dark stripes.');
    await expect(page.locator('input[name="category"]')).toHaveValue('Bags');
    await page.locator('#category').fill('Sports bags');
    await photoStep.click();
    await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    await reviewStep.click();
    await expect(page.getByText('Sports bags', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Submit report', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/my-${mode}$`));
    expect(requests.categoryWrites).toBe(0);
    expect(requests.submissions).toHaveLength(1);
    expect(requests.submissions[0].get('category')).toBe('Sports bags');
    expect(requests.submissions[0].get(`${mode}Location`)).toBe('SEUSL Main Entrance');
    const photo = requests.submissions[0].get('images');
    expect(photo.name).toBe('bag.png');
    expect(photo.type).toBe('image/png');
    expect(photo.size).toBeGreaterThan(100);
    expect(requests.uploads).toBe(1);
    const checkedBody = requests.multipartBodies[0];
    const checkedBytes = checkedBody.subarray(checkedBody.indexOf('\r\n\r\n') + 4, checkedBody.lastIndexOf('\r\n--'));
    expect(checkedBytes.equals(Buffer.from(await photo.arrayBuffer()))).toBe(true);
  });
}
