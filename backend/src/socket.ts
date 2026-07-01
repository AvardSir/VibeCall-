import { Server } from 'socket.io';
import type { Socket, DefaultEventsMap } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { AppConfig } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { ChatService, ChatMessage, ChatErrorCode } from './chat.js';
import { logger } from './logger.js';

export type JoinChatPayload = { roomId: string; identity: string; role: 'host' | 'guest' };
export type SendMessagePayload = { text: string };

export type ChatSocketBinding = { identity: string; displayName: string; roomName: string };

// NOTE: these event maps are intentionally duplicated on the frontend
// (frontend/src/shared/lib/socketEvents.ts) — this repo is not an npm workspace and follows a
// "duplicate + cross-ref" convention. A shared socket-contract module is a planned follow-up
// (see docs/superpowers/plans/2026-06-30-mr3-review-fixes.md → Deferred follow-ups). Keep both in sync.
export type RoomEndReason = 'host_ended' | 'grace_expired';

export type ServerToClientEvents = {
  chat_history: (messages: ChatMessage[]) => void;
  chat_message: (message: ChatMessage) => void;
  message_failed: (e: { code: ChatErrorCode }) => void;
  grace_tick: (payload: { secondsLeft: number }) => void;
  grace_cancelled: () => void;
  room_ended: (payload: { reason: RoomEndReason }) => void;
  participant_removed: (payload: { identity: string }) => void;
};
export type ClientToServerEvents = {
  join_chat: (payload: JoinChatPayload) => void;
  send_message: (payload: SendMessagePayload) => void;
};

type ChatSocketData = { binding?: ChatSocketBinding };

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, ChatSocketData>;
export type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, ChatSocketData>;

export type ChatGatewayDeps = {
  config: Pick<AppConfig, 'corsOrigin'>;
  admin: Pick<LivekitAdmin, 'listParticipants'>;
  chat: ChatService;
};

export async function handleJoinChat(
  socket: ChatSocket,
  deps: ChatGatewayDeps,
  payload: JoinChatPayload,
): Promise<void> {
  const roomName = payload?.roomId;
  if (typeof roomName !== 'string' || roomName.length === 0) {
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  const participants = await deps.admin.listParticipants(roomName);
  const match = participants.find((p) => p.identity === payload?.identity);
  if (!match) {
    // Not a current member of this room → do not bind, do not join the channel.
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  // Bind identity + the LiveKit-recorded display name to this socket; never trust the payload name.
  socket.data.binding = { identity: match.identity, displayName: match.name, roomName };
  socket.join(roomName);
  socket.emit('chat_history', deps.chat.history(roomName));
}

export function handleSendMessage(
  socket: ChatSocket,
  io: ChatServer,
  deps: ChatGatewayDeps,
  payload: SendMessagePayload,
): void {
  const binding = socket.data.binding;
  if (!binding) {
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  const validation = deps.chat.validateText(payload?.text);
  if (!validation.ok) {
    socket.emit('message_failed', { code: validation.code });
    return;
  }
  const message = deps.chat.build({
    roomName: binding.roomName,
    senderIdentity: binding.identity, // from the binding, never the payload
    senderName: binding.displayName,
    text: validation.value,
  });
  deps.chat.append(message);
  io.to(binding.roomName).emit('chat_message', message);
}

export function createSocketServer(httpServer: HttpServer, deps: ChatGatewayDeps): ChatServer {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, ChatSocketData>(httpServer, {
    cors: { origin: deps.config.corsOrigin },
  });

  io.on('connection', (socket) => {
    socket.on('join_chat', (payload: JoinChatPayload) => {
      void handleJoinChat(socket, deps, payload).catch((err: unknown) => {
        logger.error({ err }, 'join_chat handler failed');
      });
    });
    socket.on('send_message', (payload: SendMessagePayload) => {
      try {
        handleSendMessage(socket, io, deps, payload);
      } catch (err: unknown) {
        logger.error({ err }, 'send_message handler failed');
      }
    });
  });

  return io;
}

export function emitGraceTick(io: ChatServer, roomId: string, secondsLeft: number): void {
  io.to(roomId).emit('grace_tick', { secondsLeft });
}

export function emitGraceCancelled(io: ChatServer, roomId: string): void {
  io.to(roomId).emit('grace_cancelled');
}

export function emitRoomEnded(io: ChatServer, roomId: string, reason: RoomEndReason): void {
  io.to(roomId).emit('room_ended', { reason });
}

export function emitParticipantRemoved(io: ChatServer, roomId: string, identity: string): void {
  io.to(roomId).emit('participant_removed', { identity });
}
