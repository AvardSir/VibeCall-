import { useEffect } from 'react';
import { useSocket } from '../../../shared/hooks/useSocket';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';

// Owns the single persistent `share_state` → store subscription. Mounted exactly once by CallShell.
// The transient claim/grant bridge lives in useScreenShare, so this listener is never doubled.
export function useShareState(): void {
  const socket = useSocket();
  const setActiveSharerId = useParticipantsStore((s) => s.setActiveSharerId);

  useEffect(() => {
    const onState = (s: { activeSharerId: string | null }): void => setActiveSharerId(s.activeSharerId);
    socket.on('share_state', onState);
    return () => {
      socket.off('share_state', onState);
    };
  }, [socket, setActiveSharerId]);
}
