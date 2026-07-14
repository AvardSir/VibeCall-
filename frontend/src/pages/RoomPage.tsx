import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { endCall, getRoomStatus, joinRoom } from '../shared/lib/apiClient';
import type { JoinResponse, ParticipantRole, RoomEndReason } from '../shared/types';
import { PreJoinScreen } from '../features/prejoin';
import {
  CallEndedScreen,
  CallFullScreen,
  ConnectErrorScreen,
  GraceExpiredScreen,
  GuestLeftScreen,
  HostEndedScreen,
  InvalidLinkScreen,
  RemovedScreen,
} from '../features/room-states';
import { CallShell, ConnectingScreen } from '../features/call';
import { ChatPanel } from '../features/chat';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useMediaStore } from '../stores/useMediaStore';
import { useChatStore } from '../stores/useChatStore';
import { useParticipantsStore } from '../stores/useParticipantsStore';
import { SocketProvider } from '../shared/lib/SocketProvider';

type View =
  | 'loading'
  | 'prejoin'
  | 'full'
  | 'not-found'
  | 'connecting'
  | 'in-call'
  | 'connect-error'
  | 'ended'
  | 'left'
  | 'removed'
  | 'host-ended'
  | 'grace-expired';

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

  const mountedRef = useRef(true);
  useEffect(() => {
    // Set true on (re)mount, not just at ref init: StrictMode runs setup→cleanup→setup in dev,
    // and without restoring it here the cleanup would leave mountedRef false forever — stranding
    // every post-join `if (!mountedRef.current) return` on the connecting screen.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRoomStatus(roomId)
      .then((status) => {
        if (cancelled) return;
        if (status === 'not-found') setView('not-found');
        else if (status === 'ended') setView('ended');
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
    if (!mountedRef.current) return;
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
      roomId: result.data.roomId,
      memberToken: result.data.memberToken,
    });
    setView('in-call');
  }

  function resetRoomStores(): void {
    setSession(null);
    resetConnection();
    resetMedia();
    resetChat();
    resetParticipants();
  }

  // Guest clicked "Leave call": show the left-call screen. Deliberately does NOT recheck
  // capacity — the guest is not returning to pre-join automatically, only via explicit Rejoin.
  function handleLeave(): void {
    resetRoomStores();
    setView('left');
  }

  // GuestLeftScreen's Rejoin action: reuse the same reset + recheck-capacity path as other
  // returns to pre-join.
  function handleRejoin(): void {
    resetRoomStores();
    recheckCapacity();
  }

  async function handleEndCall(): Promise<void> {
    if (!roomId || !hostToken) return;
    await endCall(roomId, hostToken);
    resetRoomStores();
    navigate('/');
  }

  function handleRoomEnded(reason: RoomEndReason): void {
    resetRoomStores();
    setView(reason === 'host_ended' ? 'host-ended' : 'grace-expired');
  }

  function handleRemoved(): void {
    resetRoomStores();
    setView('removed');
  }

  if (view === 'loading' || view === 'connecting') return <ConnectingScreen />;
  if (view === 'not-found') return <InvalidLinkScreen />;
  if (view === 'full') return <CallFullScreen onBackToHome={() => navigate('/')} />;
  if (view === 'connect-error') return <ConnectErrorScreen onRetry={recheckCapacity} />;
  if (view === 'ended') return <CallEndedScreen />;
  if (view === 'left') return <GuestLeftScreen onRejoin={handleRejoin} />;
  if (view === 'host-ended') return <HostEndedScreen />;
  if (view === 'grace-expired') return <GraceExpiredScreen />;
  if (view === 'removed') return <RemovedScreen />;
  if (view === 'in-call' && session) {
    const participantUrl = `${window.location.origin}/r/${session.roomId}`;
    return (
      <SocketProvider>
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          role={session.role}
          participantUrl={participantUrl}
          roomId={session.roomId}
          hostToken={hostToken}
          identity={session.identity}
          onLeave={handleLeave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
          onEndCall={() => void handleEndCall()}
          onRoomEnded={handleRoomEnded}
          onRemoved={handleRemoved}
        />
        <ChatPanel role={session.role} />
      </SocketProvider>
    );
  }
  return <PreJoinScreen role={intendedRole} error={joinError} onEnter={(name) => void handleEnter(name)} />;
}
