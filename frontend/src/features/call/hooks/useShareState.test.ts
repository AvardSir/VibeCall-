import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShareState } from './useShareState';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';

type Handler = (payload: unknown) => void;
const fake = {
  handlers: new Map<string, Handler>(),
  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  },
  off(event: string, handler: Handler): void {
    if (this.handlers.get(event) === handler) this.handlers.delete(event);
  },
  trigger(event: string, payload: unknown): void {
    this.handlers.get(event)?.(payload);
  },
};

vi.mock('../../../shared/hooks/useSocket', () => ({ useSocket: () => fake }));

describe('useShareState', () => {
  beforeEach(() => {
    fake.handlers.clear();
    useParticipantsStore.getState().reset();
  });

  it('mirrors share_state into the store', () => {
    renderHook(() => useShareState());
    fake.trigger('share_state', { activeSharerId: 'p_1' });
    expect(useParticipantsStore.getState().activeSharerId).toBe('p_1');
    fake.trigger('share_state', { activeSharerId: null });
    expect(useParticipantsStore.getState().activeSharerId).toBeNull();
  });

  it('removes the exact share_state handler on unmount', () => {
    const offSpy = vi.spyOn(fake, 'off');
    const { unmount } = renderHook(() => useShareState());
    unmount();
    expect(offSpy).toHaveBeenCalledWith('share_state', expect.any(Function));
    expect(fake.handlers.has('share_state')).toBe(false);
    offSpy.mockRestore();
  });
});
