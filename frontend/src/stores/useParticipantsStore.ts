import { create } from 'zustand';
import type { CallParticipant } from '../shared/types';

type ParticipantsState = {
  participants: CallParticipant[];
  // Active screen-share owner (M6); null when nobody is sharing. Mirrors the server-authoritative
  // `share_state` broadcast — never set locally as truth.
  activeSharerId: string | null;
  setParticipants: (participants: CallParticipant[]) => void;
  setActiveSharerId: (id: string | null) => void;
  reset: () => void;
};

export const useParticipantsStore = create<ParticipantsState>()((set) => ({
  participants: [],
  activeSharerId: null,
  setParticipants: (participants) => set({ participants }),
  setActiveSharerId: (id) => set({ activeSharerId: id }),
  reset: () => set({ participants: [], activeSharerId: null }),
}));
