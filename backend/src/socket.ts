import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { AppConfig } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { ChatService } from './chat.js';
import { logger } from './logger.js';

export type JoinChatPayload = { identity: string; role: 'host' | 'guest' };
export type SendMessagePayload = { text: string };

export type ChatSocketBinding = { identity: string; displayName: string; roomName: string };

// Structural subsets of the Socket.IO `Socket`/`Server` so handlers are unit-testable
// with plain fakes. A default-typed Socket.IO socket/server satisfies these.
export type EmittingSocket = {
  data: { binding?: ChatSocketBinding };
  join(room: string): void;
  emit(event: string, payload: unknown): void;
};
export type Broadcaster = {
  to(room: string): { emit(event: string, payload: unknown): void };
};

export type ChatGatewayDeps = {
  config: Pick<AppConfig, 'fixedRoomName' | 'corsOrigin'>;
  admin: Pick<LivekitAdmin, 'listParticipants'>;
  chat: ChatService;
};

export async function handleJoinChat(
  socket: EmittingSocket,
  deps: ChatGatewayDeps,
  payload: JoinChatPayload,
): Promise<void> {
  const roomName = deps.config.fixedRoomName;
  const participants = await deps.admin.listParticipants();
  const match = participants.find((p) => p.identity === payload?.identity);
  if (!match) {
    // Not a current member → do not bind, do not join the channel.
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  // Bind identity + the LiveKit-recorded display name to this socket; never trust the payload name.
  socket.data.binding = { identity: match.identity, displayName: match.name, roomName };
  socket.join(roomName);
  socket.emit('chat_history', deps.chat.history(roomName));
}

export function handleSendMessage(
  socket: EmittingSocket,
  io: Broadcaster,
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

export function createSocketServer(httpServer: HttpServer, deps: ChatGatewayDeps): Server {
  const io = new Server(httpServer, {
    cors: { origin: deps.config.corsOrigin },
  });

  io.on('connection', (socket) => {
    socket.on('join_chat', (payload: JoinChatPayload) => {
      void handleJoinChat(socket, deps, payload).catch((err: unknown) => {
        logger.error({ err }, 'join_chat handler failed');
      });
    });
    socket.on('send_message', (payload: SendMessagePayload) => {
      handleSendMessage(socket, io, deps, payload);
    });
  });

  return io;
}
