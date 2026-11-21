import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';
import notificationService from './notificationService';

let socket = null;
const socketService = {
  connectSocket: () => {
    if (socket?.connected) return socket;
    const crossOrigin = new URL(SOCKET_URL, window.location.href).origin !== window.location.origin;
    socket = io(SOCKET_URL, {
      withCredentials: !crossOrigin,
      ...(crossOrigin && {
        // The login cookie stays on the frontend origin. Request a new ticket for each handshake.
        auth: async (sendAuth) => {
          let ticket;
          try { ticket = await notificationService.getSocketTicket(); } catch { /* unauthenticated */ }
          sendAuth(ticket ? { ticket } : {});
        },
      }),
      autoConnect: true,
      // Prefer one long-lived WebSocket session so Railway does not route
      // follow-up polling requests to a worker that cannot find the sid.
      // Keep polling as a compatibility fallback for proxies without WS.
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    return socket;
  },
  disconnectSocket: () => { if (socket) { socket.disconnect(); socket = null; } },
  onNotification: (callback) => socket?.on('notification', callback),
  offNotification: () => socket?.off('notification'),
  getSocket: () => socket,
};
export default socketService;
