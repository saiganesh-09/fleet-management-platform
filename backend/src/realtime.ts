import { Server } from 'socket.io';

/**
 * Holds the Socket.IO server instance so any service can emit realtime events
 * without circular imports. Initialized once in index.ts.
 */
let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export function emitToRole(role: string, event: string, payload: unknown) {
  io?.to(`role:${role}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToAll(event: string, payload: unknown) {
  io?.emit(event, payload);
}
