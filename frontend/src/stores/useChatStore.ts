import { create } from 'zustand';
import type { ChatMessage } from '../shared/types';

export type ChatItemStatus = 'sending' | 'delivered' | 'failed';

export type ChatItem = {
  key: string; // server id once delivered; client id while sending/failed
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text: string;
  status: ChatItemStatus;
};

type ChatState = {
  messages: ChatItem[];
  isPanelOpen: boolean;
  unreadCount: number;
  setHistory: (messages: ChatMessage[]) => void;
  receiveMessage: (message: ChatMessage, selfIdentity: string) => void;
  addOptimistic: (clientId: string, text: string, self: { identity: string; displayName: string }) => void;
  markFailed: () => void;
  openPanel: () => void;
  togglePanel: () => void;
  markAllRead: () => void;
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
  };
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isPanelOpen: false,
  unreadCount: 0,

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

  addOptimistic: (clientId, text, self) =>
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
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  markAllRead: () => set({ unreadCount: 0 }),
  reset: () => set({ messages: [], isPanelOpen: false, unreadCount: 0 }),
}));
