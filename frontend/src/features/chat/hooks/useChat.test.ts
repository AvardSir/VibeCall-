import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import { uploadAttachment } from '../../../shared/lib/apiClient';
import type { StagedFile } from '../../../stores/useChatStore';

vi.mock('../../../shared/lib/apiClient', () => ({ uploadAttachment: vi.fn() }));

const mockUploadAttachment = vi.mocked(uploadAttachment);

function makeStagedFile(name: string): StagedFile {
  return { id: `s_${name}`, file: new File(['content'], name, { type: 'image/png' }) };
}

// A minimal fake socket whose events we can drive from the test.
type Handler = (payload: unknown) => void;
const fake = {
  handlers: new Map<string, Handler>(),
  emitted: [] as { event: string; payload: unknown }[],
  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  },
  off(event: string, handler: Handler): void {
    const registered = this.handlers.get(event);
    if (registered === handler) this.handlers.delete(event);
  },
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  },
  trigger(event: string, payload: unknown) {
    this.handlers.get(event)?.(payload);
  },
};

vi.mock('../../../shared/hooks/useSocket', () => ({ useSocket: () => fake }));

describe('useChat', () => {
  beforeEach(() => {
    fake.handlers.clear();
    fake.emitted = [];
    useChatStore.getState().reset();
    useConnectionStore.getState().reset();
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_self', displayName: 'Me', roomId: 'r_test', memberToken: 'mt' });
    mockUploadAttachment.mockReset();
  });

  it('defers join_chat until the call is connected, then joins and loads history', () => {
    renderHook(() => useChat('guest'));
    // Socket connects before LiveKit finishes connecting → must NOT join yet
    // (joining here would race the SFU participant registration → NOT_A_MEMBER).
    act(() => fake.trigger('connect', undefined));
    expect(fake.emitted.find((e) => e.event === 'join_chat')).toBeUndefined();

    // LiveKit reaches 'connected' → now it is safe to join.
    act(() => useConnectionStore.getState().setPhase('connected'));
    expect(fake.emitted).toContainEqual({
      event: 'join_chat',
      payload: { identity: 'p_self', role: 'guest', roomId: 'r_test' },
    });

    act(() =>
      fake.trigger('chat_history', [
        { id: 'a', roomName: 'main', senderIdentity: 'p_x', senderName: 'X', sentAt: 1, text: 'hi' },
      ]),
    );
    expect(useChatStore.getState().messages.map((m) => m.text)).toEqual(['hi']);
  });

  it('joins exactly once on socket connect when the call is already connected', () => {
    act(() => useConnectionStore.getState().setPhase('connected'));
    renderHook(() => useChat('guest'));
    act(() => fake.trigger('connect', undefined));
    // Idempotent: the phase-effect and the connect handler must not double-join.
    expect(fake.emitted.filter((e) => e.event === 'join_chat')).toHaveLength(1);
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

  it('sendMessage adds an optimistic item and emits send_message', async () => {
    const { result } = renderHook(() => useChat('guest'));
    await act(async () => {
      result.current.sendMessage('hello', []);
      await Promise.resolve();
    });
    expect(useChatStore.getState().messages[0]).toMatchObject({ text: 'hello', status: 'sending' });
    expect(fake.emitted).toContainEqual({ event: 'send_message', payload: { text: 'hello', attachments: [] } });
  });

  it('message_failed flips the pending item to failed', async () => {
    const { result } = renderHook(() => useChat('guest'));
    await act(async () => {
      result.current.sendMessage('oops', []);
      await Promise.resolve();
    });
    act(() => fake.trigger('message_failed', { code: 'TEXT_TOO_LONG' }));
    expect(useChatStore.getState().messages[0]!.status).toBe('failed');
  });

  it('sendMessage uploads the passed files then relays their metadata on success', async () => {
    const uploaded = { fileId: 'f1', name: 'a.png', size: 3, mime: 'image/png', kind: 'image' as const, url: '/attachments/f1' };
    mockUploadAttachment.mockResolvedValue({ ok: true, data: uploaded });

    const { result } = renderHook(() => useChat('guest'));
    await act(async () => {
      result.current.sendMessage('with file', [makeStagedFile('a.png')]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUploadAttachment).toHaveBeenCalledWith('r_test', 'mt', expect.any(File));
    expect(fake.emitted).toContainEqual({
      event: 'send_message',
      payload: { text: 'with file', attachments: [uploaded] },
    });
  });

  it('sendMessage marks failed and does not relay when an upload fails', async () => {
    mockUploadAttachment.mockResolvedValue({ ok: false, error: 'FILE_TOO_LARGE' });

    const { result } = renderHook(() => useChat('guest'));
    await act(async () => {
      result.current.sendMessage('with file', [makeStagedFile('a.png')]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fake.emitted.find((e) => e.event === 'send_message')).toBeUndefined();
    expect(useChatStore.getState().messages[0]!.status).toBe('failed');
  });

  // Staging is owned by the composer (ChatInput), which consumes staged files synchronously at send
  // time; sendMessage never touches the staged store (so a slow upload can't wipe a newly-staged file).
  it('sendMessage does not clear the staged store', async () => {
    mockUploadAttachment.mockResolvedValue({
      ok: true,
      data: { fileId: 'f1', name: 'a.png', size: 3, mime: 'image/png', kind: 'image' as const, url: '/attachments/f1' },
    });
    const file = new File(['content'], 'a.png', { type: 'image/png' });
    useChatStore.getState().addStaged(file);

    const { result } = renderHook(() => useChat('guest'));
    await act(async () => {
      result.current.sendMessage('with file', [makeStagedFile('a.png')]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useChatStore.getState().stagedAttachments).toEqual([{ id: expect.any(String), file }]);
  });
});
