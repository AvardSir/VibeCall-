import { create } from 'zustand';

export type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'failed';
export type LocalParticipant = { identity: string; displayName: string; roomId: string; memberToken: string };

type ConnectionState = {
  phase: ConnectionPhase;
  localParticipant: LocalParticipant | null;
  graceSecondsLeft: number | null;
  setPhase: (phase: ConnectionPhase) => void;
  setLocalParticipant: (participant: LocalParticipant | null) => void;
  setGraceSecondsLeft: (n: number | null) => void;
  reset: () => void;
};

export const useConnectionStore = create<ConnectionState>()((set) => ({
  phase: 'idle',
  localParticipant: null,
  graceSecondsLeft: null,
  setPhase: (phase) => set({ phase }),
  setLocalParticipant: (participant) => set({ localParticipant: participant }),
  setGraceSecondsLeft: (n) => set({ graceSecondsLeft: n }),
  reset: () => set({ phase: 'idle', localParticipant: null, graceSecondsLeft: null }),
}));
