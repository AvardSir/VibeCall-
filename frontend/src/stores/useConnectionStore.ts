import { create } from 'zustand';

export type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'failed';
export type LocalParticipant = { identity: string; displayName: string; roomId: string };

type ConnectionState = {
  phase: ConnectionPhase;
  localParticipant: LocalParticipant | null;
  setPhase: (phase: ConnectionPhase) => void;
  setLocalParticipant: (participant: LocalParticipant | null) => void;
  reset: () => void;
};

export const useConnectionStore = create<ConnectionState>()((set) => ({
  phase: 'idle',
  localParticipant: null,
  setPhase: (phase) => set({ phase }),
  setLocalParticipant: (participant) => set({ localParticipant: participant }),
  reset: () => set({ phase: 'idle', localParticipant: null }),
}));
