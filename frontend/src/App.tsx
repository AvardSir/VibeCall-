import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { getRoomStatus, joinRoom } from './shared/lib/apiClient';
import type { JoinResponse } from './shared/types';
import { PreJoinScreen } from './features/prejoin';
import { CallFullScreen, ConnectErrorScreen } from './features/room-states';
import { CallShell, ConnectingScreen } from './features/call';
import { ChatPanel } from './features/chat';
import { TopBar, useApplyUiPreferences } from './features/preferences';
import { useConnectionStore } from './stores/useConnectionStore';
import { useMediaStore } from './stores/useMediaStore';
import { useChatStore } from './stores/useChatStore';
import { useParticipantsStore } from './stores/useParticipantsStore';
import { SocketProvider } from './shared/lib/SocketProvider';

const ROOM_NAME = 'main';

type View = 'loading' | 'prejoin' | 'full' | 'connecting' | 'in-call' | 'connect-error';

export function App(): JSX.Element {
  const [view, setView] = useState<View>('loading');
  const [session, setSession] = useState<JoinResponse | null>(null);
  const [capacityTick, setCapacityTick] = useState(0);
  useApplyUiPreferences();
  const setPhase = useConnectionStore((s) => s.setPhase);
  const resetConnection = useConnectionStore((s) => s.reset);
  const resetMedia = useMediaStore((s) => s.reset);
  const resetChat = useChatStore((s) => s.reset);
  const resetParticipants = useParticipantsStore((s) => s.reset);

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

  function recheckCapacity(): void {
    setView('loading');
    setCapacityTick((n) => n + 1);
  }

  async function handleEnter(name: string): Promise<void> {
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
  }

  function leave(): void {
    setSession(null);
    resetConnection();
    resetMedia();
    resetChat();
    resetParticipants();
    recheckCapacity();
  }

  let content: JSX.Element;
  if (view === 'loading' || view === 'connecting') {
    content = <ConnectingScreen />;
  } else if (view === 'full') {
    content = <CallFullScreen onBackToHome={recheckCapacity} />;
  } else if (view === 'connect-error') {
    content = <ConnectErrorScreen onRetry={recheckCapacity} />;
  } else if (view === 'in-call' && session) {
    content = (
      <SocketProvider>
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          onLeave={leave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
        />
        <ChatPanel role={session.role} />
      </SocketProvider>
    );
  } else {
    content = <PreJoinScreen onEnter={(name) => void handleEnter(name)} />;
  }

  return (
    <>
      <TopBar />
      {content}
    </>
  );
}
