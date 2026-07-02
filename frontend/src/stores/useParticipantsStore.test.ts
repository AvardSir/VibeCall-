import { describe, it, expect, beforeEach } from 'vitest';
import { useParticipantsStore } from './useParticipantsStore';
import type { CallParticipant } from '../shared/types';

const sample: CallParticipant = {
  identity: 'p_1',
  name: 'Ann',
  isLocal: true,
  isCameraEnabled: true,
  isMicrophoneEnabled: true,
};

beforeEach(() => {
  useParticipantsStore.getState().reset();
});

describe('useParticipantsStore', () => {
  it('starts empty with no active sharer', () => {
    const state = useParticipantsStore.getState();
    expect(state.participants).toEqual([]);
    expect(state.activeSharerId).toBeNull();
  });

  it('setParticipants replaces the roster', () => {
    useParticipantsStore.getState().setParticipants([sample]);
    expect(useParticipantsStore.getState().participants).toEqual([sample]);
  });

  it('reset clears the roster and active sharer', () => {
    useParticipantsStore.getState().setParticipants([sample]);
    useParticipantsStore.getState().reset();
    expect(useParticipantsStore.getState().participants).toEqual([]);
    expect(useParticipantsStore.getState().activeSharerId).toBeNull();
  });
});
