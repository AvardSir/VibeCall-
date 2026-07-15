import type { Socket } from 'socket.io-client';
import type { Attachment, ChatMessage, ChatErrorCode, ParticipantRole, RoomEndReason } from '../types';

// NOTE: intentionally duplicated from backend/src/socket.ts for now — this repo is not an npm
// workspace and follows a "duplicate + cross-ref" convention (see validation.ts↔nameValidation.ts,
// ChatMessage). A shared socket-contract module is a planned follow-up (MR3 plan → Deferred follow-ups);
// keep these maps in sync with backend/src/socket.ts until then.
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
  join_chat: (p: { roomId: string; identity: string; role: ParticipantRole }) => void;
  send_message: (p: { text: string; attachments?: Attachment[]; clientId?: string }) => void;
  claim_share: (p: { roomName: string }) => void;
  release_share: (p: { roomName: string }) => void;
};

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
