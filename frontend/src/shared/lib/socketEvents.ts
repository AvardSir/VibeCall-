import type { Socket } from 'socket.io-client';
import type { ChatMessage, ChatErrorCode, ParticipantRole } from '../types';

// NOTE: intentionally duplicated from backend/src/socket.ts for now — this repo is not an npm
// workspace and follows a "duplicate + cross-ref" convention (see validation.ts↔useNameValidation.ts,
// ChatMessage). A shared socket-contract module is a planned follow-up (MR3 plan → Deferred follow-ups);
// keep these maps in sync with backend/src/socket.ts until then.
export type ServerToClientEvents = {
  chat_history: (messages: ChatMessage[]) => void;
  chat_message: (message: ChatMessage) => void;
  message_failed: (e: { code: ChatErrorCode }) => void;
};

export type ClientToServerEvents = {
  join_chat: (p: { identity: string; role: ParticipantRole }) => void;
  send_message: (p: { text: string }) => void;
};

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
