import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from './useConnectionStore';

describe('useConnectionStore', () => {
  beforeEach(() => useConnectionStore.getState().reset());

  it('defaults to idle with no local participant', () => {
    expect(useConnectionStore.getState().phase).toBe('idle');
    expect(useConnectionStore.getState().localParticipant).toBeNull();
  });

  it('records phase and local participant', () => {
    useConnectionStore.getState().setPhase('connecting');
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_1', displayName: 'Ann', roomId: 'r_1' });
    expect(useConnectionStore.getState().phase).toBe('connecting');
    expect(useConnectionStore.getState().localParticipant?.displayName).toBe('Ann');
  });

  it('reset returns to idle', () => {
    useConnectionStore.getState().setPhase('connected');
    useConnectionStore.getState().reset();
    expect(useConnectionStore.getState().phase).toBe('idle');
    expect(useConnectionStore.getState().localParticipant).toBeNull();
  });

  it('tracks grace countdown and clears it on reset', () => {
    const s = useConnectionStore.getState();
    s.setGraceSecondsLeft(42);
    expect(useConnectionStore.getState().graceSecondsLeft).toBe(42);
    useConnectionStore.getState().reset();
    expect(useConnectionStore.getState().graceSecondsLeft).toBeNull();
  });
});
