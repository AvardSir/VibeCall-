import { create } from 'zustand';
import type { Attachment, ChatMessage } from '../shared/types';

export type ChatItemStatus = 'sending' | 'delivered' | 'failed';

export type ChatItem = {
  key: string; // server id once delivered; client id while sending/failed
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text: string;
  status: ChatItemStatus;
  attachments: Attachment[];
};

export type StagedFile = {
  id: string;
  file: File;
};

let stagedSeq = 0;

type ChatState = {
  messages: ChatItem[];
  isPanelOpen: boolean;
  unreadCount: number;
  stagedAttachments: StagedFile[];
  setHistory: (messages: ChatMessage[]) => void;
  receiveMessage: (message: ChatMessage, selfIdentity: string) => void;
  addOptimistic: (
    clientId: string,
    text: string,
    self: { identity: string; displayName: string },
    attachments?: Attachment[],
  ) => void;
  markFailed: () => void;
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

  setHistory: (messages) => set({ messages: messages.map(toDelivered) }),

  receiveMessage: (message, selfIdentity) =>
    set((state) => {
      const delivered = toDelivered(message);
      if (message.senderIdentity === selfIdentity) {
        // Reconcile with the first still-sending own message (FIFO send order).
        const idx = state.messages.findIndex((m) => m.status === 'sending');
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

  addOptimistic: (clientId, text, self, attachments = []) =>
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
        },
      ],
    })),

  markFailed: () =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.status === 'sending');
      if (idx === -1) return state;
      const messages = state.messages.slice();
      messages[idx] = { ...messages[idx]!, status: 'failed' };
      return { messages };
    }),

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

  reset: () => set({ messages: [], isPanelOpen: false, unreadCount: 0, stagedAttachments: [] }),
}));
