import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { getRoomStatus, joinRoom } from './shared/lib/apiClient';
import type { JoinResponse } from './shared/types';
import { PreJoinScreen } from './features/prejoin';
import { CallFullScreen, ConnectErrorScreen } from './features/room-states';
import { CallShell, ConnectingScreen } from './features/call';
import { ChatPanel } from './features/chat';
import { useConnectionStore } from './stores/useConnectionStore';
import { useMediaStore } from './stores/useMediaStore';
import { useChatStore } from './stores/useChatStore';

const ROOM_NAME = 'main';

type View = 'loading' | 'prejoin' | 'full' | 'connecting' | 'in-call' | 'connect-error';

export function App(): JSX.Element {
  const [view, setView] = useState<View>('loading');
  const [session, setSession] = useState<JoinResponse | null>(null);
  const [capacityTick, setCapacityTick] = useState(0);
  const setPhase = useConnectionStore((s) => s.setPhase);
  const resetConnection = useConnectionStore((s) => s.reset);
  const resetMedia = useMediaStore((s) => s.reset);
  const resetChat = useChatStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;
    getRoomStatus(ROOM_NAME)
      .then((status) => {
        if (!cancelled) setView(status === 'full' ? 'full' : 'prejoin');
      })
      .catch(() => {
        if (!cancelled) setView('prejoin');
      });
    return () => {
      cancelled = true;
    };
  }, [capacityTick]);

  const recheckCapacity = useCallback(() => {
    setView('loading');
    setCapacityTick((n) => n + 1);
  }, []);

  const handleEnter = useCallback(
    async (name: string) => {
      setView('connecting');
      setPhase('connecting');
      const result = await joinRoom(ROOM_NAME, name);
      if (!result.ok) {
        setView(result.error === 'FULL' ? 'full' : 'prejoin');
        setPhase('idle');
        return;
      }
      setSession(result.data);
      useConnectionStore.getState().setLocalParticipant({
        identity: result.data.identity,
        displayName: result.data.displayName,
      });
      setView('in-call');
    },
    [setPhase],
  );

  const leave = useCallback(() => {
    setSession(null);
    resetConnection();
    resetMedia();
    resetChat();
    recheckCapacity();
  }, [recheckCapacity, resetConnection, resetMedia, resetChat]);

  if (view === 'loading' || view === 'connecting') return <ConnectingScreen />;
  if (view === 'full') return <CallFullScreen onBackToHome={recheckCapacity} />;
  if (view === 'connect-error') return <ConnectErrorScreen onRetry={recheckCapacity} />;
  if (view === 'in-call' && session) {
    return (
      <>
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          displayName={session.displayName}
          onLeave={leave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
        />
        <ChatPanel role={session.role} />
      </>
    );
  }
  return <PreJoinScreen onEnter={(name) => void handleEnter(name)} />;
}
