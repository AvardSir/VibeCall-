import { Server } from 'socket.io';
import type { Socket, DefaultEventsMap } from 'socket.io';
import type { AppConfig } from './config.js';
import { MAX_ATTACHMENTS_PER_MESSAGE } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { ChatService, ChatMessage, ChatErrorCode } from './chat.js';
import type { Attachment } from './attachments.js';
import type { RoomRegistry } from './rooms.js';
import { logger } from './logger.js';

export type JoinChatPayload = { roomId: string; identity: string; role: 'host' | 'guest' };
// NOTE: mirrored on the frontend (frontend/src/shared/lib/socketEvents.ts) — keep both in sync.
// `clientId` is the sender's optimistic-bubble id, echoed back so the sender reconciles the exact one.
export type SendMessagePayload = { text: string; attachments?: Attachment[]; clientId?: string };

export type ChatSocketBinding = { identity: string; displayName: string; roomName: string };

// NOTE: these event maps are intentionally duplicated on the frontend
// (frontend/src/shared/lib/socketEvents.ts) — this repo is not an npm workspace and follows a
// "duplicate + cross-ref" convention. A shared socket-contract module is a planned follow-up
// (see docs/superpowers/plans/2026-06-30-mr3-review-fixes.md → Deferred follow-ups). Keep both in sync.
export type RoomEndReason = 'host_ended' | 'grace_expired';

export type ServerToClientEvents = {
  chat_history: (messages: ChatMessage[]) => void;
  chat_message: (message: ChatMessage) => void;
  message_failed: (e: { code: ChatErrorCode; clientId?: string }) => void;
  grace_tick: (payload: { secondsLeft: number }) => void;
  grace_cancelled: () => void;
  room_ended: (payload: { reason: RoomEndReason }) => void;
  participant_removed: (payload: { identity: string }) => void;
  share_granted: () => void;
  share_denied: (e: { reason: 'busy' }) => void;
  share_state: (s: { activeSharerId: string | null }) => void;
};
export type ClientToServerEvents = {
  join_chat: (payload: JoinChatPayload) => void;
  send_message: (payload: SendMessagePayload) => void;
  claim_share: (payload: { roomName: string }) => void;
  release_share: (payload: { roomName: string }) => void;
};

type ChatSocketData = { binding?: ChatSocketBinding };

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, ChatSocketData>;
export type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, ChatSocketData>;

export type ChatGatewayDeps = {
  config: Pick<AppConfig, 'corsOrigin'>;
  admin: Pick<LivekitAdmin, 'listParticipants'>;
  chat: ChatService;
  registry: Pick<RoomRegistry, 'claimShare' | 'releaseShare' | 'getActiveSharer' | 'get' | 'clearShare'>;
  // Current host-reconnect countdown for a room in grace, or null when it is not in grace.
  // Late-bound to the grace service in server.ts (io is created before grace, so these are read
  // through closures rather than holding a direct reference).
  getGraceRemaining: (roomId: string) => number | null;
  // startGrace: called when a host socket disconnects (treat as an unexpected drop, PRD US-14/FR-4).
  // cancelGrace: called when the host returns over the socket while the room is in grace.
  startGrace: (roomId: string) => void;
  cancelGrace: (roomId: string) => void;
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
  // Bring a late joiner in sync with an in-progress share: without this, a socket that connects while
  // someone is already sharing never learns the active sharer (share_state only fires on claim/release)
  // and stays stuck in the grid layout, never subscribing to the share view.
  socket.emit('share_state', { activeSharerId: deps.registry.getActiveSharer(roomName) });
  // A host returning over the socket during grace cancels the countdown (PRD US-14). Connection-state
  // recovery is off, so a transient drop reconnects as a NEW socket that re-runs join_chat with the
  // host's existing identity (still === room.hostIdentity, because no REST re-join rotated it). A full
  // page reload cancels earlier, via the REST re-join path (routes/rooms/controller). Guests never cancel.
  const room = deps.registry.get(roomName);
  if (room && match.identity === room.hostIdentity && room.status === 'grace') {
    deps.cancelGrace(roomName);
    return;
  }
  // Bring a socket that joins mid-grace in sync at once (FR-4): grace_tick otherwise only fires on
  // the ~1s broadcast, so without this the host-disconnect overlay would not show until the next
  // tick. Emit the live countdown directly to the joining socket when the room is in grace.
  const graceRemaining = deps.getGraceRemaining(roomName);
  if (graceRemaining !== null) {
    socket.emit('grace_tick', { secondsLeft: graceRemaining });
  }
}

// Treat a host Socket.IO disconnect (tab close, network loss) as an unexpected drop that starts the
// 60s grace period (PRD US-14 / FR-4). Exported for unit testing; wired to the socket 'disconnect'
// event in createSocketServer.
export function handleDisconnect(socket: ChatSocket, io: ChatServer, deps: ChatGatewayDeps): void {
  const binding = socket.data.binding;
  if (!binding) return; // never completed join_chat → not a room member, nothing to do
  const room = deps.registry.get(binding.roomName);
  if (!room) return;
  // The `status === 'active'` guard mirrors the participant_left webhook: an intentional End call sets
  // status to 'ending' first, so it never trips grace. Grace is also started from that webhook;
  // startGrace is idempotent, so both firing for a single drop is safe.
  if (binding.identity === room.hostIdentity && room.status === 'active') {
    // Force-clear any active share, mirroring the webhook path, so a stale sharer is not left set.
    if (deps.registry.clearShare(binding.roomName)) {
      broadcastShareState(io, binding.roomName, null);
    }
    deps.startGrace(binding.roomName);
  }
}

export function handleSendMessage(
  socket: ChatSocket,
  io: ChatServer,
  deps: ChatGatewayDeps,
  payload: SendMessagePayload,
): void {
  // Echoed back on any failure/broadcast so the sender flips or reconciles the exact optimistic bubble.
  const clientId = payload?.clientId;
  const binding = socket.data.binding;
  if (!binding) {
    socket.emit('message_failed', { code: 'NOT_A_MEMBER', clientId });
    return;
  }
  const attachments = payload?.attachments ?? [];
  if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    socket.emit('message_failed', { code: 'TOO_MANY_ATTACHMENTS', clientId });
    return;
  }
  const validation = deps.chat.validateMessage({ text: payload?.text ?? '', attachmentCount: attachments.length });
  if (!validation.ok) {
    socket.emit('message_failed', { code: validation.code, clientId });
    return;
  }
  const message = deps.chat.build({
    roomName: binding.roomName,
    senderIdentity: binding.identity, // from the binding, never the payload
    senderName: binding.displayName,
    text: validation.value,
    attachments,
  });
  deps.chat.append(message);
  // Attach clientId to the broadcast copy only — the stored `message` (history) stays clientId-free.
  io.to(binding.roomName).emit('chat_message', { ...message, clientId });
}

export function broadcastShareState(io: ChatServer, roomName: string, activeSharerId: string | null): void {
  io.to(roomName).emit('share_state', { activeSharerId });
}

export function handleClaimShare(socket: ChatSocket, io: ChatServer, deps: ChatGatewayDeps): void {
  const binding = socket.data.binding;
  if (!binding) {
    socket.emit('share_denied', { reason: 'busy' }); // unbound → treat as unable to share
    return;
  }
  const result = deps.registry.claimShare(binding.roomName, binding.identity);
  if (result.ok) {
    socket.emit('share_granted');
    broadcastShareState(io, binding.roomName, binding.identity);
  } else {
    socket.emit('share_denied', { reason: 'busy' });
  }
}

export function handleReleaseShare(socket: ChatSocket, io: ChatServer, deps: ChatGatewayDeps): void {
  const binding = socket.data.binding;
  if (!binding) return;
  if (deps.registry.releaseShare(binding.roomName, binding.identity)) {
    broadcastShareState(io, binding.roomName, null);
  }
}

export function createSocketServer(deps: ChatGatewayDeps): ChatServer {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, ChatSocketData>({
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
    socket.on('claim_share', () => {
      try {
        handleClaimShare(socket, io, deps);
      } catch (err: unknown) {
        logger.error({ err }, 'claim_share handler failed');
      }
    });
    socket.on('release_share', () => {
      try {
        handleReleaseShare(socket, io, deps);
      } catch (err: unknown) {
        logger.error({ err }, 'release_share handler failed');
      }
    });
    socket.on('disconnect', () => {
      try {
        handleDisconnect(socket, io, deps);
      } catch (err: unknown) {
        logger.error({ err }, 'disconnect handler failed');
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
