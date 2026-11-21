import AssistantHandoff from '../models/AssistantHandoff.js';
import AssistantSession from '../models/AssistantSession.js';
import { inspectAIInput, redactPrivateText } from '../services/aiSafetyService.js';
import { SESSION_TTL_MS, sessionKeyFor } from '../services/conversationStateService.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { paginate } from '../utils/pagination.js';

const handoffSafeText = (value) => redactPrivateText(String(value || ''))
  .replace(/\b(?:student\s*)?(?:id|reg(?:istration)?)\s*[:#-]?\s*[a-z0-9/-]{4,}\b/giu, '[private identifier removed]')
  .replace(/\*{4,}\d{4}/gu, '[private contact removed]')
  .replace(/\b[A-Z0-9._%+-]{1,2}\*{3}@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[private contact removed]');

const redactedSessionSummary = (session, reason) => {
  const slots = session.slots instanceof Map ? Object.fromEntries(session.slots) : session.slots || {};
  const safeSlots = Object.fromEntries(Object.entries(slots).slice(0, 20).map(([key, entry]) => [
    String(key).slice(0, 40),
    handoffSafeText(entry?.value ?? entry ?? '').slice(0, 300),
  ]));
  return handoffSafeText(JSON.stringify({
    reportType: session.reportType,
    state: session.state,
    missing: session.missing,
    details: safeSlots,
    userRequest: reason,
  })).slice(0, 3000);
};

const requestAssistantHandoff = asyncHandler(async (req, res) => {
  if (req.body?.consent !== true) throw ApiError.badRequest('Explicit consent is required before sharing a redacted assistant summary with helpdesk.');
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  if (!sessionId || sessionId.length > 160) throw ApiError.badRequest('A valid assistant session ID is required.');
  const sessionKey = sessionKeyFor(sessionId);
  const requestedBy = req.user._id;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const inspected = inspectAIInput(req.body?.reason || 'User requested helpdesk support.', { maxLength: 500 });
  const reason = handoffSafeText(inspected.redactedText).slice(0, 500) || 'User requested helpdesk support.';

  // A support request can be the first server-side action for a conversation.
  await AssistantSession.updateOne({ sessionKey }, {
    $setOnInsert: { ownerId: requestedBy, createdAt: now, updatedAt: now, lastActivityAt: now, expiresAt },
  }, { upsert: true, timestamps: false });

  const ticket = await AssistantSession.db.transaction(async (transaction) => {
    // Write the owner-checked session first so requests for the same conversation serialize.
    const session = await AssistantSession.findOneAndUpdate({
      sessionKey, $or: [{ ownerId: requestedBy }, { ownerId: null }],
    }, { $set: { ownerId: requestedBy, lastActivityAt: now, expiresAt }, $inc: { __v: 1 } }, { new: true, session: transaction });
    if (!session) throw ApiError.forbidden('This assistant session belongs to another account.');

    let handoff = await AssistantHandoff.findOne({
      sessionKey, requestedBy, status: { $in: ['queued', 'in-progress'] },
    }).session(transaction);
    if (!handoff) {
      handoff = new AssistantHandoff({
        sessionKey, assistantSessionId: session._id, requestedBy, reason,
        redactedSummary: redactedSessionSummary(session.toObject(), reason),
        responseStyle: session.responseStyle, safetyFlags: inspected.issues, consent: true,
      });
      await handoff.save({ session: transaction });
      session.state = 'handoff';
      session.stateVersion += 1;
      await session.save({ session: transaction });
    }
    return { ticketId: handoff._id, status: handoff.status, stateVersion: session.stateVersion, policy: handoff.policy };
  });
  return ApiResponse.created(ticket, 'Conversation queued for authorized helpdesk review.').send(res);
});

const getOwnHandoff = asyncHandler(async (req, res) => {
  const handoff = await AssistantHandoff.findOne({ _id: req.params.id, requestedBy: req.user._id })
    .select('_id status createdAt resolvedAt policy')
    .lean();
  if (!handoff) throw ApiError.notFound('Helpdesk handoff not found.');
  return ApiResponse.ok(handoff, 'Helpdesk handoff status retrieved.').send(res);
});

const listAssistantHandoffs = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const totalDocs = await AssistantHandoff.countDocuments(filter);
  const pagination = paginate(req.query, totalDocs);
  const handoffs = await AssistantHandoff.find(filter)
    .populate('requestedBy', 'fullName email')
    .populate('assignedTo', 'fullName')
    .sort({ createdAt: 1 })
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();
  return ApiResponse.ok({ handoffs, pagination, policy: 'Only a consented, privacy-redacted summary is available to authorized administrators.' }, 'Assistant handoffs retrieved.').send(res);
});

const reviewAssistantHandoff = asyncHandler(async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['in-progress', 'resolved', 'closed'].includes(status)) throw ApiError.badRequest('Unsupported handoff status.');
  const handoff = await AssistantHandoff.findById(req.params.id);
  if (!handoff) throw ApiError.notFound('Assistant handoff not found.');
  handoff.status = status;
  handoff.assignedTo = req.user._id;
  handoff.adminNote = String(req.body?.adminNote || '').normalize('NFKC').trim().slice(0, 1000);
  handoff.resolvedAt = ['resolved', 'closed'].includes(status) ? new Date() : null;
  await handoff.save();
  return ApiResponse.ok(handoff, 'Helpdesk handoff updated.').send(res);
});

export {
  getOwnHandoff,
  listAssistantHandoffs,
  redactedSessionSummary,
  requestAssistantHandoff,
  reviewAssistantHandoff,
};
