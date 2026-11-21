import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.RUN_DB_INTEGRATION === 'true' && Boolean(process.env.MONGO_URI || process.env.MONGODB_URI);

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
