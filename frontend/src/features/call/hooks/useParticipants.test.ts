import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';

type FakeParticipant = {
  identity: string;
  name: string;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  joinedAt: Date;
};

function makeParticipant(
  identity: string,
  name: string,
  cam: boolean,
  mic: boolean,
  joinedAtMs: number,
): FakeParticipant {
  return { identity, name, isCameraEnabled: cam, isMicrophoneEnabled: mic, joinedAt: new Date(joinedAtMs) };
}

function makeRoom() {
  const handlers = new Set<() => void>();
  const localParticipant = makeParticipant('local', 'Me', true, true, 1000);
  const remoteParticipants = new Map<string, FakeParticipant>();
  return {
    localParticipant,
    remoteParticipants,
    on(_event: string, handler: () => void) {
      handlers.add(handler);
      return this;
    },
    off(_event: string, handler: () => void) {
      handlers.delete(handler);
      return this;
    },
    emit() {
      handlers.forEach((handler) => handler());
    },
  };
}

const room = makeRoom();
vi.mock('@livekit/components-react', () => ({
  useRoomContext: () => room,
}));

import { useParticipants } from './useParticipants';

beforeEach(() => {
  useParticipantsStore.getState().reset();
  room.remoteParticipants.clear();
  room.localParticipant.isCameraEnabled = true;
  room.localParticipant.isMicrophoneEnabled = true;
});

describe('useParticipants', () => {
  it('seeds the store with the local participant on mount', () => {
    renderHook(() => useParticipants());
    const { participants } = useParticipantsStore.getState();
    expect(participants).toHaveLength(1);
    expect(participants[0]).toMatchObject({ identity: 'local', name: 'Me', isLocal: true });
  });

  it('adds a remote participant when one connects (ordered by joinedAt, local first)', () => {
    renderHook(() => useParticipants());
    room.remoteParticipants.set('r1', makeParticipant('r1', 'Bob', true, true, 2000));
    room.emit();
    const { participants } = useParticipantsStore.getState();
    expect(participants.map((p) => p.identity)).toEqual(['local', 'r1']);
    expect(participants[1]).toMatchObject({ isLocal: false, name: 'Bob' });
  });

  it('reflects a camera/mic toggle on the next event', () => {
    renderHook(() => useParticipants());
    room.localParticipant.isCameraEnabled = false;
    room.localParticipant.isMicrophoneEnabled = false;
    room.emit();
    const local = useParticipantsStore.getState().participants[0];
    expect(local.isCameraEnabled).toBe(false);
    expect(local.isMicrophoneEnabled).toBe(false);
  });

  it('removes a participant when they disconnect', () => {
    renderHook(() => useParticipants());
    room.remoteParticipants.set('r1', makeParticipant('r1', 'Bob', true, true, 2000));
    room.emit();
    room.remoteParticipants.delete('r1');
    room.emit();
    expect(useParticipantsStore.getState().participants.map((p) => p.identity)).toEqual(['local']);
  });
});
