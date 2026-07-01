import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '../../../shared/i18n';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';

const setScreenShareEnabled = vi.fn();

const room = {
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({ localParticipant: { setScreenShareEnabled } }),
  useRoomContext: () => room,
}));

type Handler = (payload?: unknown) => void;
const fake = {
  handlers: new Map<string, Handler>(),
  emitted: [] as { event: string; payload: unknown }[],
  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  },
  off(event: string, handler: Handler): void {
    if (this.handlers.get(event) === handler) this.handlers.delete(event);
  },
  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  },
  trigger(event: string, payload?: unknown): void {
    this.handlers.get(event)?.(payload);
  },
};

vi.mock('../../../shared/hooks/useSocket', () => ({ useSocket: () => fake }));

import { useScreenShare } from './useScreenShare';

function seedLocal(identity = 'p_self'): void {
  useConnectionStore.getState().setLocalParticipant({ identity, displayName: 'Me', roomId: 'r1', memberToken: 'mt' });
}

beforeEach(() => {
  fake.handlers.clear();
  fake.emitted = [];
  setScreenShareEnabled.mockReset();
  room.on.mockClear();
  room.off.mockClear();
  useConnectionStore.getState().reset();
  useParticipantsStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useScreenShare', () => {
  it('claims, then publishes on grant', async () => {
    seedLocal();
    setScreenShareEnabled.mockResolvedValue({});
    const { result } = renderHook(() => useScreenShare());
    act(() => result.current.toggle());
    expect(fake.emitted).toContainEqual({ event: 'claim_share', payload: { roomName: 'r1' } });
    await act(async () => {
      fake.trigger('share_granted');
      await Promise.resolve();
    });
    expect(setScreenShareEnabled).toHaveBeenCalledWith(true);
  });

  it('releases and shows the capture error when the picker is cancelled (publish rejects)', async () => {
    seedLocal();
    setScreenShareEnabled.mockRejectedValue(new Error('cancelled'));
    const { result } = renderHook(() => useScreenShare());
    act(() => result.current.toggle());
    await act(async () => {
      fake.trigger('share_granted');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fake.emitted).toContainEqual({ event: 'release_share', payload: { roomName: 'r1' } });
    expect(result.current.error).toBe('Unable to share your screen. Please check your browser permissions.');
  });

  it('does not claim or open the picker when someone else is sharing (busy)', () => {
    seedLocal();
    useParticipantsStore.getState().setActiveSharerId('p_other');
    const { result } = renderHook(() => useScreenShare());
    expect(result.current.isBusy).toBe(true);
    act(() => result.current.toggle());
    expect(fake.emitted.find((e) => e.event === 'claim_share')).toBeUndefined();
    expect(setScreenShareEnabled).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Someone is already sharing their screen');
  });

  it('stops sharing and releases the slot when toggled while sharing', () => {
    seedLocal();
    setScreenShareEnabled.mockResolvedValue(undefined);
    useParticipantsStore.getState().setActiveSharerId('p_self');
    const { result } = renderHook(() => useScreenShare());
    expect(result.current.isSharing).toBe(true);
    act(() => result.current.toggle());
    expect(setScreenShareEnabled).toHaveBeenCalledWith(false);
    expect(fake.emitted).toContainEqual({ event: 'release_share', payload: { roomName: 'r1' } });
  });

  it('auto-dismisses the error after 4 seconds', () => {
    vi.useFakeTimers();
    seedLocal();
    useParticipantsStore.getState().setActiveSharerId('p_other');
    const { result } = renderHook(() => useScreenShare());
    act(() => result.current.toggle());
    expect(result.current.error).toBe('Someone is already sharing their screen');
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.error).toBeNull();
  });
});
