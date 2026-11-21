import jwt from 'jsonwebtoken';
import { accessSecret } from '../config/security.js';

const issuer = 'smart-lf-socket';

export const issueSocketTicket = (userId, familyId, origin) => jwt.sign(
  { sid: familyId },
  accessSecret,
  {
    algorithm: 'HS256',
    issuer,
    subject: userId,
    audience: origin,
    expiresIn: '30s',
  },
);

export const verifySocketTicket = (ticket, origin) => {
  if (typeof ticket !== 'string' || !ticket || ticket.length > 1024 || !origin) {
    throw new Error('Invalid socket ticket');
  }
  return jwt.verify(ticket, accessSecret, {
    algorithms: ['HS256'],
    issuer,
    audience: origin,
  });
};
