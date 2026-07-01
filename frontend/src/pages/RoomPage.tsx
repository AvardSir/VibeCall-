import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getRoomStatus, joinRoom } from '../shared/lib/apiClient';
import type { JoinResponse, ParticipantRole } from '../shared/types';
import { PreJoinScreen } from '../features/prejoin';
import { CallFullScreen, ConnectErrorScreen, InvalidLinkScreen } from '../features/room-states';
import { CallShell, ConnectingScreen } from '../features/call';
import { ChatPanel } from '../features/chat';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useMediaStore } from '../stores/useMediaStore';
import { useChatStore } from '../stores/useChatStore';
import { useParticipantsStore } from '../stores/useParticipantsStore';

type View = 'loading' | 'prejoin' | 'full' | 'not-found' | 'connecting' | 'in-call' | 'connect-error';

function readHostToken(hash: string): string | undefined {
  // Host URL: /r/<roomId>#h=<token>. The hash is never sent to the server.
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('h');
  return token ?? undefined;
}

export function RoomPage(): JSX.Element {
  const { roomId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const hostToken = readHostToken(location.hash);
  const intendedRole: ParticipantRole = hostToken !== undefined ? 'host' : 'guest';

  const [view, setView] = useState<View>('loading');
  const [session, setSession] = useState<JoinResponse | null>(null);
  const [capacityTick, setCapacityTick] = useState(0);
  const [joinError, setJoinError] = useState(false);

  const setPhase = useConnectionStore((s) => s.setPhase);
  const resetConnection = useConnectionStore((s) => s.reset);
  const resetMedia = useMediaStore((s) => s.reset);
  const resetChat = useChatStore((s) => s.reset);
  const resetParticipants = useParticipantsStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;
    getRoomStatus(roomId)
      .then((status) => {
        if (cancelled) return;
        if (status === 'not-found') setView('not-found');
        else setView(status === 'full' ? 'full' : 'prejoin');
      })
      .catch(() => {
        if (!cancelled) setView('prejoin');
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, capacityTick]);

  function recheckCapacity(): void {
    setView('loading');
    setCapacityTick((n) => n + 1);
  }

  async function handleEnter(name: string): Promise<void> {
    setJoinError(false);
    setView('connecting');
    setPhase('connecting');
    const result = await joinRoom(roomId, name, hostToken);
    if (!result.ok) {
      if (result.error === 'FULL') setView('full');
      else if (result.error === 'NOT_FOUND') setView('not-found');
      // INTERNAL / unexpected: fall back to pre-join and surface an inline error.
      else {
        setJoinError(true);
        setView('prejoin');
      }
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

  if (view === 'loading' || view === 'connecting') return <ConnectingScreen />;
  if (view === 'not-found') return <InvalidLinkScreen />;
  if (view === 'full') return <CallFullScreen onBackToHome={() => navigate('/')} />;
  if (view === 'connect-error') return <ConnectErrorScreen onRetry={recheckCapacity} />;
  if (view === 'in-call' && session) {
    const participantUrl = `${window.location.origin}/r/${session.roomId}`;
    return (
      <>
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          role={session.role}
          participantUrl={participantUrl}
          onLeave={leave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
        />
        <ChatPanel role={session.role} />
      </>
    );
  }
  return <PreJoinScreen role={intendedRole} error={joinError} onEnter={(name) => void handleEnter(name)} />;
}
