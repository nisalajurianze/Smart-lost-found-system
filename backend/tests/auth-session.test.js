import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

process.env.JWT_ACCESS_SECRET = 'auth-session-test-secret-that-is-longer-than-32-characters';
process.env.CLIENT_URLS = 'https://lost.example.edu,https://admin.example.edu';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(backend, relative), 'utf8');

test('access JWT is bound to one server-side refresh family', async () => {
  const { issueAccessToken } = await import('../services/sessionService.js');
  const token = issueAccessToken(
    { _id: { toString: () => '507f1f77bcf86cd799439011' }, role: 'user', email: 'user@example.edu' },
    'family-123',
  );
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: 'smart-lf',
  });
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
  assert.equal(payload.sid, 'family-123');
  assert.equal(typeof payload.jti, 'string');
  assert.ok(payload.jti.length >= 16);
  assert.throws(
    () => issueAccessToken({ _id: { toString: () => payload.sub }, role: 'user', email: 'user@example.edu' }),
    /valid session family/,
  );
});

test('legacy access JWT without a session family fails before database access', async () => {
  const { verifyAccessSession } = await import('../middlewares/authMiddleware.js');
  const legacy = jwt.sign({}, process.env.JWT_ACCESS_SECRET, {
    subject: '507f1f77bcf86cd799439011',
    issuer: 'smart-lf',
    algorithm: 'HS256',
    expiresIn: '5m',
  });
  await assert.rejects(() => verifyAccessSession(legacy), /Access session is invalid/);
});

test('HTTP access verification requires an active, uncompromised refresh family', () => {
  const middleware = read('middlewares/authMiddleware.js');
  assert.match(middleware, /typeof familyId !== 'string'/);
  assert.match(middleware, /RefreshSession\.exists/);
  assert.match(middleware, /return verifySessionFamily\(decoded\.sub, decoded\.sid\)/);
  assert.match(middleware, /familyId,/);
  assert.match(middleware, /revokedAt: null/);
  assert.match(middleware, /compromisedAt: null/);
  assert.match(middleware, /familyExpiresAt: \{ \$gt: now \}/);
});

test('refresh rotation is transaction-only and preserves absolute family expiry', () => {
  const service = read('services/sessionService.js');
  const model = read('models/RefreshSession.js');
  assert.match(service, /withTransaction\(\(\) => performRotation\(dbSession\)\)/);
  assert.doesNotMatch(service, /performRotation\(null\)/);
  assert.match(service, /expiresAt: familyExpiresAt/);
  assert.match(service, /familyExpiresAt,/);
  assert.match(service, /compromisedAt: now/);
  assert.match(model, /familyExpiresAt: \{ type: Date, required: true \}/);
  assert.match(model, /compromisedAt: \{ type: Date, default: null \}/);
});

test('password changes and resets commit credential mutation with session revocation', () => {
  for (const relative of ['controllers/userController.js', 'controllers/authController.js']) {
    const controller = read(relative);
    assert.match(controller, /session\.withTransaction/);
    assert.match(controller, /user\.save\(\{ session \}\)/);
    assert.match(controller, /revokeAllUserSessions\(user\._id, \{ session, disconnect: false \}\)/);
    assert.match(controller, /disconnectRevokedUserSessions/);
  }
});

test('Socket.IO accepts only exact configured origins and revalidates sessions', async () => {
  const { isAllowedSocketOrigin } = await import('../config/socket.js');
  assert.equal(isAllowedSocketOrigin('https://lost.example.edu'), true);
  assert.equal(isAllowedSocketOrigin('https://admin.example.edu/'), true);
  assert.equal(isAllowedSocketOrigin('https://lost.example.edu.attacker.invalid'), false);
  assert.equal(isAllowedSocketOrigin('https://attacker.invalid'), false);
  assert.equal(isAllowedSocketOrigin(undefined), false);

  const socket = read('config/socket.js');
  assert.match(socket, /allowRequest\(req, callback\)/);
  assert.match(socket, /verifyAccessSession/);
  assert.match(socket, /setInterval\(\(\) => \{ void revalidate\(\); \}, SOCKET_REVALIDATE_MS\)/);
  assert.match(socket, /disconnectSessionSockets/);
  assert.match(socket, /disconnectUserSockets/);
});

test('socket tickets are scoped to an origin, expire quickly, and cannot authorize API requests', async () => {
  const { issueSocketTicket, verifySocketTicket } = await import('../utils/socketTicket.js');
  const { verifyAccessSession } = await import('../middlewares/authMiddleware.js');
  const origin = 'https://lost.example.edu';
  const userId = '507f1f77bcf86cd799439011';
  const ticket = issueSocketTicket(userId, 'family-123', origin);
  const claims = verifySocketTicket(ticket, origin);
  assert.equal(claims.sub, userId);
  assert.equal(claims.sid, 'family-123');
  assert.equal(claims.exp - claims.iat, 30);
  assert.throws(() => verifySocketTicket(ticket, 'https://admin.example.edu'), /audience invalid/);
  await assert.rejects(() => verifyAccessSession(ticket), /issuer invalid/);
});

test('a cross-origin socket receives user notifications only while its session is active', async (t) => {
  const { createServer } = await import('node:http');
  const { closeSocket, initSocket } = await import('../config/socket.js');
  const { issueSocketTicket } = await import('../utils/socketTicket.js');
  const { default: User } = await import('../models/User.js');
  const { default: RefreshSession } = await import('../models/RefreshSession.js');
  const origin = 'https://lost.example.edu';
  const userId = '507f1f77bcf86cd799439011';
  const familyId = 'family-123';
  let active = true;

  t.mock.method(User, 'findById', async (id) => {
    assert.equal(id, userId);
    return { _id: userId, role: 'user', isActive: true };
  });
  t.mock.method(RefreshSession, 'exists', async (filter) => {
    assert.equal(filter.familyId, familyId);
    assert.equal(filter.revokedAt, null);
    return active ? { _id: userId } : null;
  });

  const server = createServer();
  const io = await initSocket(server);
  t.after(() => closeSocket());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/socket.io/?EIO=4&transport=polling';
  const poll = (url, options) => fetch(url, {
    signal: AbortSignal.timeout(4000),
    ...options,
    headers: { Origin: origin, ...options?.headers },
  });

  const handshake = async (ticket) => {
    const response = await poll(endpoint);
    assert.equal(response.status, 200);
    const initial = await response.text();
    assert.match(initial, /^0\{/);
    const url = endpoint + '&sid=' + encodeURIComponent(JSON.parse(initial.slice(1)).sid);
    const connect = await poll(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: '40' + JSON.stringify({ ticket }),
    });
    assert.equal(connect.status, 200);
    await connect.text();
    return url;
  };

  const ticket = issueSocketTicket(userId, familyId, origin);
  const authenticated = await handshake(ticket);
  assert.match(await (await poll(authenticated)).text(), /^40\{/);
  io.to('user:' + userId).emit('notification', { title: 'Test notification' });
  assert.equal(await (await poll(authenticated)).text(), '42["notification",{"title":"Test notification"}]');

  active = false;
  const revoked = await handshake(ticket);
  assert.match(await (await poll(revoked)).text(), /^44.*Invalid session/);
});
