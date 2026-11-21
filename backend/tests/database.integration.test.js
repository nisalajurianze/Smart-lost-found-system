import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.RUN_DB_INTEGRATION === 'true' && Boolean(process.env.MONGO_URI || process.env.MONGODB_URI);

test('multiple manual reports can be submitted alongside legacy null IDs and unique assistant IDs', { skip: !enabled }, async () => {
  const mongoose = (await import('mongoose')).default;
  const LostItem = (await import('../models/LostItem.js')).default;
  const FoundItem = (await import('../models/FoundItem.js')).default;
  const { createLostItem } = await import('../controllers/lostItemController.js');
  const { createFoundItem } = await import('../controllers/foundItemController.js');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri, { dbName: `smart_lf_report_ids_${Date.now()}` });
  try {
    const userId = new mongoose.Types.ObjectId();
    const item = {
      userId, category: 'Bags', itemName: 'Red backpack', description: 'A red backpack with a black zipper.',
    };
    for (const [Model, createReport, type] of [[LostItem, createLostItem, 'lost'], [FoundItem, createFoundItem, 'found']]) {
      await Model.createIndexes();
      const body = { ...item, [`${type}Location`]: 'SEUSL Main Library', [`${type}Date`]: new Date() };
      const legacy = await Model.create({ ...body, assistantSubmissionId: null });
      const submit = (itemName) => new Promise((resolve, reject) => createReport(
        { user: { _id: userId }, files: [], body: { ...body, itemName } },
        { status: (status) => ({ json: ({ data }) => resolve({ status, data }) }) },
        reject,
      ));
      const first = await submit('Blue backpack');
      const second = await submit('Green backpack');
      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.notEqual(first.data._id, second.data._id);
      assert.equal(await Model.countDocuments({ assistantSubmissionId: { $exists: false } }), 2);
      assert.equal((await Model.findById(legacy._id).lean()).assistantSubmissionId, null);

      const assistantSubmissionId = new mongoose.Types.ObjectId();
      await Model.create({ ...body, assistantSubmissionId });
      await assert.rejects(Model.create({ ...body, assistantSubmissionId }), { code: 11000 });
    }
  } finally {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  }
});

test('report settings persist and keep contact private through a matched claim', { skip: !enabled }, async () => {
  const mongoose = (await import('mongoose')).default;
  const User = (await import('../models/User.js')).default;
  const LostItem = (await import('../models/LostItem.js')).default;
  const FoundItem = (await import('../models/FoundItem.js')).default;
  const Match = (await import('../models/Match.js')).default;
  const Claim = (await import('../models/ClaimRequest.js')).default;
  const { createFoundItem, updateFoundItem } = await import('../controllers/foundItemController.js');
  const { createLostItem, updateLostItem } = await import('../controllers/lostItemController.js');
  const { getClaimRequestById, shareClaimContact } = await import('../controllers/claimController.js');
  const invoke = (handler, req) => new Promise((resolve, reject) => {
    handler(req, { status: () => ({ json: ({ data }) => resolve(data) }) }, reject);
  });
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, { dbName: `smart_lf_contact_${Date.now()}` });
  try {
    const createUser = (name, phone) => User.create({
      fullName: `Test ${name}`, email: `${name}@example.com`, studentId: `INT-${name}`,
      phone, password: 'StrongPassword!123', isVerified: true,
    });
    const lostOwner = await createUser('reporter', '0771234567');
    const foundOwner = await createUser('claimant', '0771234568');
    const data = { itemName: 'Red backpack', description: 'A red backpack with a black zipper.', category: 'Bags' };
    const lost = await invoke(createLostItem, { user: lostOwner, body: {
      ...data, lostLocation: 'SEUSL Main Library', lostDate: new Date(),
    } });
    const found = await invoke(createFoundItem, { user: foundOwner, body: {
      ...data, foundLocation: 'SEUSL Main Library', foundDate: new Date(), contactVisibility: 'private',
    } });
    assert.equal(lost.contactVisibility, 'request_only');
    assert.equal(found.contactVisibility, 'private');

    await invoke(updateLostItem, { user: lostOwner, params: { id: lost._id }, body: { contactVisibility: 'private' } });
    await invoke(updateFoundItem, { user: foundOwner, params: { id: found._id }, body: { contactPreference: 'phone' } });
    assert.equal((await LostItem.findById(lost._id)).contactVisibility, 'private');
    assert.equal((await FoundItem.findById(found._id)).contactVisibility, 'private');

    const match = await Match.create({
      lostItemId: lost._id, foundItemId: found._id, lostUserId: lostOwner._id, foundUserId: foundOwner._id,
      status: 'confirmed', similarityScore: 95,
    });
    const claim = await Claim.create({
      lostItemId: lost._id, claimantId: foundOwner._id, matchId: match._id, status: 'approved',
      isContactShared: true, proofDescription: 'A distinctive black zipper clip.',
    });
    const params = { id: claim._id };
    const reporterView = await invoke(getClaimRequestById, { params, user: lostOwner });
    const claimantView = await invoke(getClaimRequestById, { params, user: foundOwner });
    assert.equal(reporterView.matchId, String(match._id));
    assert.equal(reporterView.claimantId.phone, undefined);
    assert.equal(claimantView.lostItemId.userId.email, undefined);
    await assert.rejects(invoke(shareClaimContact, { params, user: lostOwner }), { statusCode: 409 });
    await Match.deleteOne({ _id: match._id });
    assert.equal((await invoke(getClaimRequestById, { params, user: lostOwner })).claimantId.phone, undefined);
  } finally {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  }
});

test('concurrent refresh reuse revokes the complete session family', { skip: !enabled }, async () => {
  process.env.JWT_ACCESS_SECRET ||= 'integration-test-secret-that-is-longer-than-32-characters';
  process.env.NODE_ENV = 'test';
  const mongoose = (await import('mongoose')).default;
  const User = (await import('../models/User.js')).default;
  const RefreshSession = (await import('../models/RefreshSession.js')).default;
  const { createSession, rotateSession } = await import('../services/sessionService.js');
  const { verifyAccessSession } = await import('../middlewares/authMiddleware.js');

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri, { dbName: `smart_lf_integration_${Date.now()}` });
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName, 'A replica set is required for transaction tests');
    const user = await User.create({
      fullName: 'Integration User',
      email: `integration-${Date.now()}@example.com`,
      studentId: `INT-${Date.now()}`,
      password: 'StrongPassword!123',
      isVerified: true,
    });
    const req = { get: () => 'node-test', ip: '127.0.0.1', socket: {} };
    const cookies = new Map();
    const res = { cookie: (name, value) => cookies.set(name, value) };
    await createSession(user, req, res);
    const raw = cookies.get('refreshToken');
    const initialAccess = cookies.get('accessToken');
    assert.ok(raw);
    assert.ok(initialAccess);
    const initialSession = await RefreshSession.findOne({ userId: user._id }).lean();
    assert.ok(initialSession.familyExpiresAt);
    assert.equal(initialSession.expiresAt.getTime(), initialSession.familyExpiresAt.getTime());

    const firstCookies = new Map();
    const secondCookies = new Map();
    const results = await Promise.allSettled([
      rotateSession(raw, req, { cookie: (name, value) => firstCookies.set(name, value) }),
      rotateSession(raw, req, { cookie: (name, value) => secondCookies.set(name, value) }),
    ]);
    assert.equal(results.filter((entry) => entry.status === 'fulfilled').length, 1);
    assert.equal(results.filter((entry) => entry.status === 'rejected').length, 1);
    const active = await RefreshSession.countDocuments({ userId: user._id, revokedAt: null, expiresAt: { $gt: new Date() } });
    assert.equal(active, 0, 'Reuse detection must revoke the replacement token too');
    const family = await RefreshSession.find({ userId: user._id }).lean();
    assert.ok(family.length >= 2);
    assert.ok(family.every((entry) => entry.familyExpiresAt.getTime() === initialSession.familyExpiresAt.getTime()));
    assert.ok(family.every((entry) => entry.compromisedAt instanceof Date));
    await assert.rejects(() => verifyAccessSession(initialAccess), /no longer active/);
  } finally {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  }
});

test('first-open helpdesk requests create one consented ticket per conversation', { skip: !enabled }, async () => {
  const mongoose = (await import('mongoose')).default;
  const AssistantSession = (await import('../models/AssistantSession.js')).default;
  const AssistantHandoff = (await import('../models/AssistantHandoff.js')).default;
  const { requestAssistantHandoff } = await import('../controllers/assistantHandoffController.js');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, { dbName: `smart_lf_handoff_${Date.now()}` });

  const owner = new mongoose.Types.ObjectId();
  const otherAccount = new mongoose.Types.ObjectId();
  const request = (body, _id = owner) => new Promise((resolve, reject) => {
    const res = { status: (httpStatus) => ({ json: ({ data }) => resolve({ httpStatus, ...data }) }) };
    requestAssistantHandoff({ user: { _id }, body }, res, reject);
  });
  const body = { sessionId: 'first-open-conversation', consent: true, reason: 'Need help. Call 0771234567.' };

  try {
    await Promise.all([AssistantSession.init(), AssistantHandoff.init()]);
    await assert.rejects(request({ ...body, consent: false }), { statusCode: 400 });
    assert.equal(await AssistantSession.countDocuments(), 0);

    const [first, second] = await Promise.all([request(body), request(body)]);
    assert.equal(first.httpStatus, 201);
    assert.equal(first.status, 'queued');
    assert.ok(first.ticketId);
    assert.deepEqual(second.ticketId, first.ticketId);
    assert.equal(first.stateVersion, 1);
    assert.equal(second.stateVersion, 1);
    assert.equal(await AssistantHandoff.countDocuments(), 1);
    const ticket = await AssistantHandoff.findById(first.ticketId);
    assert.doesNotMatch(`${ticket.reason} ${ticket.redactedSummary}`, /0771234567/);
    assert.equal(String(ticket.requestedBy), String(owner));
    const conversation = await AssistantSession.findById(ticket.assistantSessionId);
    assert.equal(conversation.state, 'handoff');
    assert.ok(conversation.expiresAt > new Date());
    await assert.rejects(request(body, otherAccount), { statusCode: 403 });
    assert.equal(await AssistantHandoff.countDocuments(), 1);

    await AssistantHandoff.updateOne({ _id: first.ticketId }, { status: 'resolved' });
    const followUp = await request(body);
    assert.notDeepEqual(followUp.ticketId, first.ticketId);
    assert.equal(followUp.stateVersion, 2);
  } finally {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  }
});
