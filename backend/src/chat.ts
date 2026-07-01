import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Attachment } from './attachments.js';

export type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string; // unique per participant (server-generated id)
  senderName: string; // display name; may be duplicated across participants
  sentAt: number; // epoch ms; rendered as HH:MM on the client
  text: string; // max 1000 chars
  attachments: Attachment[];
};

export type ChatErrorCode = 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' | 'NOT_A_MEMBER' | 'TOO_MANY_ATTACHMENTS';

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

// Text may be blank when at least one attachment is present (an attachment-only message).
export function validateMessage(input: { text: string; attachmentCount: number }): MessageValidation {
  const { text, attachmentCount } = input;
  if (text.trim().length === 0 && attachmentCount === 0) {
    return { ok: false, code: 'EMPTY_MESSAGE' };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, code: 'TEXT_TOO_LONG' };
  }
  return { ok: true, value: text };
}

export type ChatService = {
  validateText(raw: unknown): MessageValidation;
  validateMessage(input: { text: string; attachmentCount: number }): MessageValidation;
  build(input: {
    roomName: string;
    senderIdentity: string;
    senderName: string;
    text: string;
    attachments?: Attachment[];
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
    validateMessage,
    build({ roomName, senderIdentity, senderName, text, attachments }) {
      return {
        id: newId(),
        roomName,
        senderIdentity,
        senderName,
        sentAt: now(),
        text,
        attachments: attachments ?? [],
      };
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
