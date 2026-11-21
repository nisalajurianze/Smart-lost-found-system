import test from 'node:test';
import assert from 'node:assert/strict';
import { resetAiProviderStateForTests } from '../services/aiProviderService.js';
import { reviewReportPhoto, verifyReportImages } from '../services/imageAnalysisService.js';
import { cloudinary } from '../config/cloudinary.js';
import { initCloudinary, uploadMultipleReportImages } from '../services/cloudinaryService.js';

const validImage = { buffer: Buffer.from('test-image'), mimetype: 'image/png' };
const responseFor = (value) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(value) } }] }) });
const baseSuggestion = {
  isSpam: false,
  isItemPhoto: true,
  itemName: 'Red backpack',
  category: 'Bags',
  description: 'A red backpack with two black zippers.',
  imageQuality: 'good',
  moderationDecision: 'allow',
  privacyWarnings: [],
  redactionRegions: [],
  ocrRegions: [],
  safetyLabels: [],
};

test('server image gate accepts only an explicit safe physical item result', async () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  try {
    Object.assign(process.env, {
      AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
      AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1',
    });
    global.fetch = async () => responseFor(baseSuggestion);
    resetAiProviderStateForTests();
    await assert.doesNotReject(() => verifyReportImages([validImage]));
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  }
});

test('server image gate rejects explicit sexual content and non-item photos', async () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  try {
    Object.assign(process.env, {
      AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
      AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1',
    });
    resetAiProviderStateForTests();
    global.fetch = async () => responseFor({ ...baseSuggestion, isItemPhoto: false, moderationDecision: 'reject', description: 'Pornographic explicit sexual content.' });
    await assert.rejects(() => verifyReportImages([validImage]), (error) => error.code === 'IMAGE_NOT_ALLOWED');
    resetAiProviderStateForTests();
    global.fetch = async () => responseFor({ ...baseSuggestion, isItemPhoto: false, moderationDecision: 'allow' });
    await assert.rejects(() => verifyReportImages([validImage]), (error) => error.code === 'IMAGE_NOT_ALLOWED');
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  }
});

test('server image gate fails closed when safety provider is unavailable', async () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  try {
    Object.assign(process.env, {
      AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
      AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1',
    });
    resetAiProviderStateForTests();
    global.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(() => verifyReportImages([validImage]), (error) => error.code === 'IMAGE_SAFETY_UNAVAILABLE');
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  }
});

test('a rejected non-item with no invented category is rejected, not reported as an outage', async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  });
  Object.assign(process.env, { AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
    AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1' });
  t.mock.method(global, 'fetch', async () => responseFor({ isSpam: true, isItemPhoto: false, moderationDecision: 'reject', itemName: '', category: '' }));
  resetAiProviderStateForTests();
  await assert.rejects(() => verifyReportImages([validImage]), (error) => error.code === 'IMAGE_NOT_ALLOWED');
});

test('missing positive moderation fields can never authorize an upload', async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  });
  Object.assign(process.env, { AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
    AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1' });
  t.mock.method(global, 'fetch', async () => responseFor({ isSpam: false, isItemPhoto: true, moderationDecision: 'allow' }));
  resetAiProviderStateForTests();
  await assert.rejects(() => verifyReportImages([validImage]), (error) => error.code === 'IMAGE_SAFETY_UNAVAILABLE');
});

test('provider safety refusal is a rejection, not an outage', async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  });
  Object.assign(process.env, { AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
    AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1' });
  t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => ({ choices: [{ message: { refusal: 'Policy refusal' }, finish_reason: 'content_filter' }] }) }));
  resetAiProviderStateForTests();
  await assert.rejects(() => verifyReportImages([validImage]), (error) => error.code === 'IMAGE_NOT_ALLOWED' && /safety policy/.test(error.message));
});

test('public report storage accepts a clear item while blocking missing or flagged privacy evidence before upload', async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  });
  Object.assign(process.env, {
    AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
    AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1',
    CLOUDINARY_CLOUD_NAME: 'privacy-test', CLOUDINARY_API_KEY: 'fixture-key', CLOUDINARY_API_SECRET: 'fixture-value',
  });
  resetAiProviderStateForTests();
  assert.equal(initCloudinary(), true);

  let replies = [];
  t.mock.method(global, 'fetch', async () => responseFor(replies.shift()));
  const stored = [];
  t.mock.method(cloudinary.uploader, 'upload_stream', (options, done) => ({
    end(buffer) {
      assert.strictEqual(buffer, validImage.buffer);
      stored.push(options);
      done(null, {
        public_id: options.folder + '/preview',
        secure_url: 'https://cdn.example/preview.jpg',
        format: 'jpg',
        type: options.type,
      });
    },
  }));

  replies = [baseSuggestion, { ...baseSuggestion, privacyWarnings: ['Identity card in background'] }];
  await assert.rejects(() => uploadMultipleReportImages([validImage, validImage], 'lost-items'), {
    code: 'IMAGE_PRIVACY_REVIEW',
    statusCode: 400,
  });
  assert.deepEqual(stored, []);

  replies = [{ ...baseSuggestion, ocrRegions: [{ category: 'item-marking', text: '0771234567' }] }];
  await assert.rejects(() => uploadMultipleReportImages([validImage], 'found-items'), { code: 'IMAGE_PRIVACY_REVIEW' });
  assert.deepEqual(stored, []);

  replies = [{ ...baseSuggestion, redactionRegions: [{ reason: 'Visible face', x: 0, y: 0, width: 0.2, height: 0.2 }] }];
  await assert.rejects(() => uploadMultipleReportImages([validImage], 'found-items'), { code: 'IMAGE_PRIVACY_REVIEW' });
  assert.deepEqual(stored, []);

  replies = [{ ...baseSuggestion, ocrRegions: undefined }];
  await assert.rejects(() => uploadMultipleReportImages([validImage], 'lost-items'), { code: 'IMAGE_SAFETY_UNAVAILABLE' });
  assert.deepEqual(stored, []);

  replies = [{ ...baseSuggestion, ocrRegions: [{ category: 'item-marking', text: 'Logitech G502' }] }];
  const [safeImage] = await uploadMultipleReportImages([validImage], 'lost-items');
  assert.equal(stored[0].type, 'authenticated');
  assert.equal(stored[1].type, 'upload');
  assert.deepEqual(stored[1].transformation, [{ width: 900, height: 900, crop: 'limit', quality: 75, flags: 'force_strip' }]);
  assert.equal(safeImage.privacyStatus, 'safe_public');
  assert.equal(safeImage.url, 'https://cdn.example/preview.jpg');
  assert.deepEqual(safeImage.originalAsset, {
    publicId: 'lost-items/originals/preview',
    format: 'jpg',
    deliveryType: 'authenticated',
  });
});

test('submission reuses only a recent server-approved photo for the same account, bytes and MIME type', async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  });
  Object.assign(process.env, {
    AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
    AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1',
  });
  resetAiProviderStateForTests();
  t.mock.timers.enable({ apis: ['Date'] });

  const review = t.mock.method(global, 'fetch', async () => responseFor(baseSuggestion));
  const owner = 'photo-owner';
  await reviewReportPhoto(validImage, owner);
  await verifyReportImages([{ ...validImage, buffer: Buffer.from(validImage.buffer) }], owner);
  assert.equal(review.mock.callCount(), 1);

  await verifyReportImages([validImage], 'other-owner');
  await verifyReportImages([{ ...validImage, buffer: Buffer.from('updated-photo') }], owner);
  await verifyReportImages([{ ...validImage, mimetype: 'image/jpeg' }], owner);
  t.mock.timers.tick(15 * 60_000);
  await verifyReportImages([validImage], owner);
  assert.equal(review.mock.callCount(), 5);
});

test('preview never records a public approval for an image with privacy flags', async (t) => {
  const originalEnv = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    resetAiProviderStateForTests();
  });
  Object.assign(process.env, {
    AI_ENABLED: 'true', AI_API_KEY: 'test-key', AI_API_URL: 'https://vision.example.test/chat',
    AI_VISION_PROVIDER: 'primary', AI_VISION_MODEL: 'vision-test', AI_MAX_ATTEMPTS: '1',
  });
  resetAiProviderStateForTests();
  const review = t.mock.method(global, 'fetch', async () => responseFor({
    ...baseSuggestion, privacyWarnings: ['Identity card in background'],
  }));
  const preview = await reviewReportPhoto(validImage, 'private-photo-owner');
  assert.deepEqual(preview.privacyWarnings, ['Identity card in background']);
  await assert.rejects(() => verifyReportImages([validImage], 'private-photo-owner'), {
    code: 'IMAGE_PRIVACY_REVIEW',
  });
  assert.equal(review.mock.callCount(), 2);
});
