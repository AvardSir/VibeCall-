import { create } from 'zustand';
import type { Attachment, ChatMessage } from '../shared/types';

export type ChatItemStatus = 'sending' | 'delivered' | 'failed';

export type StagedFile = {
  id: string;
  file: File;
};

export type ChatItem = {
  key: string; // server id once delivered; client id while sending/failed
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text: string;
  status: ChatItemStatus;
  attachments: Attachment[];
  // Retained on own optimistic messages so a failed send can be restored to the composer (FR-24).
  // Dropped once the message is reconciled to a server-delivered item.
  stagedFiles?: StagedFile[];
};

let stagedSeq = 0;

type ChatState = {
  messages: ChatItem[];
  isPanelOpen: boolean;
  unreadCount: number;
  stagedAttachments: StagedFile[];
  // Text to restore into the composer (e.g. a failed message being retried). `null` when there is
  // nothing pending; ChatInput consumes it and clears it.
  composerDraft: string | null;
  setHistory: (messages: ChatMessage[]) => void;
  receiveMessage: (message: ChatMessage, selfIdentity: string) => void;
  addOptimistic: (
    clientId: string,
    text: string,
    self: { identity: string; displayName: string },
    attachments?: Attachment[],
    stagedFiles?: StagedFile[],
  ) => void;
  markFailed: (clientId: string) => void;
  retryMessage: (clientId: string) => void;
  clearComposerDraft: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  markAllRead: () => void;
  addStaged: (file: File) => void;
  removeStaged: (id: string) => void;
  clearStaged: () => void;
  reset: () => void;
};

function toDelivered(message: ChatMessage): ChatItem {
  return {
    key: message.id,
    senderIdentity: message.senderIdentity,
    senderName: message.senderName,
    sentAt: message.sentAt,
    // ChatMessage.text is optional once attachments carry a message (M5); ChatItem.text stays a
    // required string for now — attachment rendering is a later task, so default to ''.
    text: message.text ?? '',
    status: 'delivered',
    attachments: message.attachments,
  };
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isPanelOpen: false,
  unreadCount: 0,
  stagedAttachments: [],
  composerDraft: null,

  setHistory: (messages) => set({ messages: messages.map(toDelivered) }),

  receiveMessage: (message, selfIdentity) =>
    set((state) => {
      const delivered = toDelivered(message);
      if (message.senderIdentity === selfIdentity) {
        // Reconcile the exact optimistic bubble by the echoed client id — matching by id, not "the
        // first still-sending item", is required because sends resolve out of order (a quick text can
        // be delivered while an earlier attachment is still uploading). Fall back to the oldest sending
        // item if the id is absent (defensive; the server echoes it for own sends).
        const idx =
          message.clientId !== undefined
            ? state.messages.findIndex((m) => m.key === message.clientId)
            : state.messages.findIndex((m) => m.status === 'sending');
        if (idx !== -1) {
          const messages = state.messages.slice();
          messages[idx] = delivered;
          return { messages };
        }
        return { messages: [...state.messages, delivered] };
      }
      return {
        messages: [...state.messages, delivered],
        unreadCount: state.isPanelOpen ? state.unreadCount : state.unreadCount + 1,
      };
    }),

  addOptimistic: (clientId, text, self, attachments = [], stagedFiles = []) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          key: clientId,
          senderIdentity: self.identity,
          senderName: self.displayName,
          sentAt: Date.now(),
          text,
          status: 'sending',
          attachments,
          stagedFiles,
        },
      ],
    })),

  // Flip the specific in-flight message (matched by its client id) to failed. Matching by id — not
  // "the first still-sending item" — is required because uploads resolve out of send order, so the
  // failing message is not necessarily the oldest one still sending.
  markFailed: (clientId) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.key === clientId);
      if (idx === -1) return state;
      const messages = state.messages.slice();
      messages[idx] = { ...messages[idx]!, status: 'failed' };
      return { messages };
    }),

  // Restore a failed message's content to the composer so it can be resent (FR-24/US-10): drop the
  // failed bubble, re-stage its attachments, and hand its text back to ChatInput via composerDraft.
  retryMessage: (clientId) =>
    set((state) => {
      const item = state.messages.find((m) => m.key === clientId);
      if (!item) return state;
      return {
        messages: state.messages.filter((m) => m.key !== clientId),
        stagedAttachments: item.stagedFiles ?? [],
        composerDraft: item.text,
      };
    }),

  clearComposerDraft: () => set({ composerDraft: null }),

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  markAllRead: () => set({ unreadCount: 0 }),

  addStaged: (file) =>
    set((state) => ({
      stagedAttachments: [...state.stagedAttachments, { id: `s_${stagedSeq++}`, file }],
    })),
  removeStaged: (id) =>
    set((state) => ({
      stagedAttachments: state.stagedAttachments.filter((s) => s.id !== id),
    })),
  clearStaged: () => set({ stagedAttachments: [] }),

  reset: () =>
    set({ messages: [], isPanelOpen: false, unreadCount: 0, stagedAttachments: [], composerDraft: null }),
}));
