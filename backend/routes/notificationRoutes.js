// ============================================
// Notification Routes
// Real-time notifications endpoints
// ============================================

import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToPush,
  unsubscribeFromPush,
  getVapidPublicKey,
  getNotificationPreferences,
  updateNotificationPreferences
} from '../controllers/notificationController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { clientOrigins } from '../config/security.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { issueSocketTicket } from '../utils/socketTicket.js';
import validate from '../middlewares/validateMiddleware.js';
import { mongoIdParam, notificationQueryValidator, notificationPreferencesValidator, pushSubscriptionValidator } from '../utils/validators.js';

const router = express.Router();

// Public route to get VAPID key
router.get('/push/public-key', getVapidPublicKey);

// Require user authentication for all other notifications endpoints
router.use(protect);

router.post('/socket-ticket', (req, res) => {
  const origin = req.get('origin')?.replace(/\/$/, '');
  if (!clientOrigins.includes(origin)) throw ApiError.forbidden('Socket ticket origin is not allowed.');
  const ticket = issueSocketTicket(req.user._id.toString(), req.sessionFamilyId, origin);
  res.set('Cache-Control', 'no-store');
  return ApiResponse.ok({ ticket }).send(res);
});

router.get('/preferences', getNotificationPreferences);
router.put('/preferences', notificationPreferencesValidator, validate, updateNotificationPreferences);
router.get('/', notificationQueryValidator, validate, getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', mongoIdParam, validate, markAsRead);
router.delete('/:id', mongoIdParam, validate, deleteNotification);

// Push Notification Routes
router.post('/push/subscribe', pushSubscriptionValidator, validate, subscribeToPush);
router.delete('/push/unsubscribe', unsubscribeFromPush);

export default router;
