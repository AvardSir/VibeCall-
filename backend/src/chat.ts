import { randomUUID } from 'node:crypto';
import { z } from 'zod';

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

// Reason codes are carried as the zod issue message so the first failing check maps straight to
// a MessageValidation code. Checks are ordered empty-before-length; a value cannot fail both.
const messageTextSchema = z
  .string({ error: 'EMPTY_MESSAGE' })
  .refine((s) => s.trim().length > 0, { error: 'EMPTY_MESSAGE' })
  .refine((s) => s.length <= MAX_TEXT_LENGTH, { error: 'TEXT_TOO_LONG' });

export function validateMessageText(raw: unknown): MessageValidation {
  const result = messageTextSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  const [issue] = result.error.issues;
  const code = issue?.message === 'TEXT_TOO_LONG' ? 'TEXT_TOO_LONG' : 'EMPTY_MESSAGE';
  return { ok: false, code };
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
