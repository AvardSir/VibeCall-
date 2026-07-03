import { randomUUID } from 'node:crypto';
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

// Text may be blank when at least one attachment is present (an attachment-only message).
// Leading/trailing whitespace is trimmed here so the trimmed value is what gets built, stored,
// and broadcast (VAL-ChatText) — callers use `value`, never the raw input.
export function validateMessage(input: { text: string; attachmentCount: number }): MessageValidation {
  const { text, attachmentCount } = input;
  const trimmed = text.trim();
  if (trimmed.length === 0 && attachmentCount === 0) {
    return { ok: false, code: 'EMPTY_MESSAGE' };
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { ok: false, code: 'TEXT_TOO_LONG' };
  }
  return { ok: true, value: trimmed };
}

export type ChatService = {
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
