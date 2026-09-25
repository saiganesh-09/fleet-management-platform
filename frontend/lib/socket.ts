import { io, Socket } from 'socket.io-client';
import { getTokens } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

/** Lazily create the authenticated socket connection. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getTokens()?.accessToken }),
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
