import { create } from 'zustand';
import type { CallParticipant } from '../shared/types';

type ParticipantsState = {
  participants: CallParticipant[];
  // Forward-compat for screen share (M6); always null in M2.
  activeSharerId: string | null;
  setParticipants: (participants: CallParticipant[]) => void;
  reset: () => void;
};

export const useParticipantsStore = create<ParticipantsState>()((set) => ({
  participants: [],
  activeSharerId: null,
  setParticipants: (participants) => set({ participants }),
  reset: () => set({ participants: [], activeSharerId: null }),
}));
