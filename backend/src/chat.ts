import { randomUUID } from 'node:crypto';

export type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string; // unique per participant (server-generated id)
  senderName: string; // display name; may be duplicated across participants
  sentAt: number; // epoch ms; rendered as HH:MM on the client
  text: string; // max 1000 chars
  // attachments deferred (master §3.5) — added later, no shape change to the above
};

export type ChatErrorCode = 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' | 'NOT_A_MEMBER';

export const MAX_TEXT_LENGTH = 1000;

export type MessageValidation =
  | { ok: true; value: string }
  | { ok: false; code: 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' };

export function validateMessageText(raw: unknown): MessageValidation {
  if (typeof raw !== 'string') return { ok: false, code: 'EMPTY_MESSAGE' };
  if (raw.trim().length === 0) return { ok: false, code: 'EMPTY_MESSAGE' };
  if (raw.length > MAX_TEXT_LENGTH) return { ok: false, code: 'TEXT_TOO_LONG' };
  return { ok: true, value: raw };
}

export type ChatService = {
  validateText(raw: unknown): MessageValidation;
  build(input: {
    roomName: string;
    senderIdentity: string;
    senderName: string;
    text: string;
  }): ChatMessage;
  append(message: ChatMessage): void;
  history(roomName: string): ChatMessage[];
  clear(roomName: string): void;
};

export type ChatServiceOptions = {
  now?: () => number;
  newId?: () => string;
};

export function createChatService(options: ChatServiceOptions = {}): ChatService {
  const now = options.now ?? ((): number => Date.now());
  const newId = options.newId ?? ((): string => randomUUID());
  const histories = new Map<string, ChatMessage[]>();

  return {
    validateText: validateMessageText,
    build({ roomName, senderIdentity, senderName, text }) {
      return { id: newId(), roomName, senderIdentity, senderName, sentAt: now(), text };
    },
    append(message) {
      const list = histories.get(message.roomName) ?? [];
      list.push(message);
      histories.set(message.roomName, list);
    },
    history(roomName) {
      // Return a copy so callers cannot mutate internal state.
      return [...(histories.get(roomName) ?? [])];
    },
    clear(roomName) {
      histories.delete(roomName);
    },
  };
}
