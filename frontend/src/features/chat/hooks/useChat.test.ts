import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';

// A minimal fake socket whose events we can drive from the test.
type Handler = (payload: unknown) => void;
const fake = {
  handlers: new Map<string, Handler>(),
  emitted: [] as { event: string; payload: unknown }[],
  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  },
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  },
  removeAllListeners() {
    this.handlers.clear();
  },
  disconnect: vi.fn(),
  trigger(event: string, payload: unknown) {
    this.handlers.get(event)?.(payload);
  },
};

vi.mock('../../../shared/lib/socketClient', () => ({
  createSocket: () => fake,
}));

describe('useChat', () => {
  beforeEach(() => {
    fake.handlers.clear();
    fake.emitted = [];
    useChatStore.getState().reset();
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_self', displayName: 'Me' });
  });

  it('emits join_chat on connect and loads history', () => {
    renderHook(() => useChat('guest'));
    act(() => fake.trigger('connect', undefined));
    expect(fake.emitted).toContainEqual({ event: 'join_chat', payload: { identity: 'p_self', role: 'guest' } });

    act(() =>
      fake.trigger('chat_history', [
        { id: 'a', roomName: 'main', senderIdentity: 'p_x', senderName: 'X', sentAt: 1, text: 'hi' },
      ]),
    );
    expect(useChatStore.getState().messages.map((m) => m.text)).toEqual(['hi']);
  });

  it('appends incoming chat_message to the store', () => {
    renderHook(() => useChat('guest'));
    act(() =>
      fake.trigger('chat_message', {
        id: 'b',
        roomName: 'main',
        senderIdentity: 'p_x',
        senderName: 'X',
        sentAt: 2,
        text: 'yo',
      }),
    );
    expect(useChatStore.getState().messages.map((m) => m.text)).toEqual(['yo']);
  });

  it('sendMessage adds an optimistic item and emits send_message', () => {
    const { result } = renderHook(() => useChat('guest'));
    act(() => result.current.sendMessage('hello'));
    expect(useChatStore.getState().messages[0]).toMatchObject({ text: 'hello', status: 'sending' });
    expect(fake.emitted).toContainEqual({ event: 'send_message', payload: { text: 'hello' } });
  });

  it('message_failed flips the pending item to failed', () => {
    const { result } = renderHook(() => useChat('guest'));
    act(() => result.current.sendMessage('oops'));
    act(() => fake.trigger('message_failed', { code: 'TEXT_TOO_LONG' }));
    expect(useChatStore.getState().messages[0]!.status).toBe('failed');
  });
});
