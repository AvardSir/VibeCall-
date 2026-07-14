import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import type { AppSocket } from '../../../shared/lib/socketEvents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only handler map, not app code
type Handlers = Record<string, (...args: any[]) => void>;

const on = vi.fn();
const off = vi.fn();

// A single stable socket instance for the whole test — this mirrors the real SocketProvider,
// which owns one long-lived socket per app session (not a new one per render).
const socket = { on, off } as unknown as AppSocket;
function fakeSocket(): AppSocket {
  return socket;
}

vi.mock('../../../shared/hooks/useSocket', () => ({
  useSocket: () => fakeSocket(),
}));

import { useRoomLifecycle } from './useRoomLifecycle';

function capturedHandlers(): Handlers {
  const handlers: Handlers = {};
  for (const call of on.mock.calls) {
    const [event, handler] = call as [string, (...args: unknown[]) => void];
    handlers[event] = handler;
  }
  return handlers;
}

beforeEach(() => {
  on.mockClear();
  off.mockClear();
  useConnectionStore.getState().reset();
});

describe('useRoomLifecycle', () => {
  it('sets graceSecondsLeft on grace_tick', () => {
    renderHook(() => useRoomLifecycle({ identity: 'p_1', onRoomEnded: vi.fn(), onRemoved: vi.fn() }));
    const handlers = capturedHandlers();
    handlers.grace_tick({ secondsLeft: 42 });
    expect(useConnectionStore.getState().graceSecondsLeft).toBe(42);
  });

  it('clears graceSecondsLeft on grace_cancelled', () => {
    useConnectionStore.getState().setGraceSecondsLeft(10);
    renderHook(() => useRoomLifecycle({ identity: 'p_1', onRoomEnded: vi.fn(), onRemoved: vi.fn() }));
    const handlers = capturedHandlers();
    handlers.grace_cancelled();
    expect(useConnectionStore.getState().graceSecondsLeft).toBeNull();
  });

  it('calls onRoomEnded with the reason on room_ended', () => {
    const onRoomEnded = vi.fn();
    renderHook(() => useRoomLifecycle({ identity: 'p_1', onRoomEnded, onRemoved: vi.fn() }));
    const handlers = capturedHandlers();
    handlers.room_ended({ reason: 'host_ended' });
    expect(onRoomEnded).toHaveBeenCalledWith('host_ended');
  });

  it('calls onRemoved when participant_removed matches the local identity', () => {
    const onRemoved = vi.fn();
    renderHook(() => useRoomLifecycle({ identity: 'p_1', onRoomEnded: vi.fn(), onRemoved }));
    const handlers = capturedHandlers();
    handlers.participant_removed({ identity: 'p_1' });
    expect(onRemoved).toHaveBeenCalledOnce();
  });

  it('does NOT call onRemoved when participant_removed is for a different identity', () => {
    const onRemoved = vi.fn();
    renderHook(() => useRoomLifecycle({ identity: 'p_1', onRoomEnded: vi.fn(), onRemoved }));
    const handlers = capturedHandlers();
    handlers.participant_removed({ identity: 'p_2' });
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('reads the current identity from the latest render (ref-backed, not stale)', () => {
    const onRemoved = vi.fn();
    const { rerender } = renderHook(
      ({ identity }: { identity: string }) =>
        useRoomLifecycle({ identity, onRoomEnded: vi.fn(), onRemoved }),
      { initialProps: { identity: 'p_1' } },
    );
    rerender({ identity: 'p_2' });
    const handlers = capturedHandlers();
    handlers.participant_removed({ identity: 'p_2' });
    expect(onRemoved).toHaveBeenCalledOnce();
  });

  it('registers each handler exactly once and does not re-register on re-render', () => {
    const { rerender } = renderHook(
      (props: { onRoomEnded: () => void; onRemoved: () => void }) =>
        useRoomLifecycle({ identity: 'p_1', ...props }),
      { initialProps: { onRoomEnded: vi.fn(), onRemoved: vi.fn() } },
    );
    expect(on).toHaveBeenCalledTimes(4);
    // Re-render with brand-new callback references (as a parent re-render would produce) —
    // the subscribe effect must not tear down and re-subscribe.
    rerender({ onRoomEnded: vi.fn(), onRemoved: vi.fn() });
    expect(on).toHaveBeenCalledTimes(4);
    expect(off).not.toHaveBeenCalled();
  });

  it('calls socket.off with the exact same handler references on cleanup, and never removeAllListeners/disconnect', () => {
    const { unmount } = renderHook(() =>
      useRoomLifecycle({ identity: 'p_1', onRoomEnded: vi.fn(), onRemoved: vi.fn() }),
    );
    const handlers = capturedHandlers();
    unmount();
    expect(off).toHaveBeenCalledTimes(4);
    expect(off).toHaveBeenCalledWith('grace_tick', handlers.grace_tick);
    expect(off).toHaveBeenCalledWith('grace_cancelled', handlers.grace_cancelled);
    expect(off).toHaveBeenCalledWith('room_ended', handlers.room_ended);
    expect(off).toHaveBeenCalledWith('participant_removed', handlers.participant_removed);
    // Belt-and-suspenders: the fake socket has no removeAllListeners/disconnect at all, so
    // calling either would throw. Assert the mock object doesn't even expose them.
    expect((fakeSocket() as unknown as { removeAllListeners?: unknown }).removeAllListeners).toBeUndefined();
    expect((fakeSocket() as unknown as { disconnect?: unknown }).disconnect).toBeUndefined();
  });
});
