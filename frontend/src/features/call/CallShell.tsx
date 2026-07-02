import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import clsx from 'clsx';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { ConnectionError, ConnectionErrorReason } from 'livekit-client';
import '@livekit/components-styles';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { useMediaStore } from '../../stores/useMediaStore';
import { removeParticipant } from '../../shared/lib/apiClient';
import type { ParticipantRole, RoomEndReason } from '../../shared/types';
import { CallStage } from './components/CallStage';
import { ControlsBar } from './components/ControlsBar';
import { GraceOverlay } from './components/GraceOverlay';
import { RemoveGuestDialog } from './components/RemoveGuestDialog';
import { useRoomLifecycle } from './hooks/useRoomLifecycle';
import { useShareState } from './hooks/useShareState';
import { useParticipantsStore } from '../../stores/useParticipantsStore';
import { useChatStore } from '../../stores/useChatStore';

export type CallShellProps = {
  accessToken: string;
  serverUrl: string;
  role: ParticipantRole;
  participantUrl: string;
  roomId: string;
  hostToken?: string;
  identity: string;
  onLeave: () => void;
  onConnectError: () => void;
  onRoomFull: () => void;
  onEndCall: () => void;
  onRoomEnded: (reason: RoomEndReason) => void;
  onRemoved: () => void;
};

type RemoveTarget = { identity: string; name: string };

export function CallShell({
  accessToken,
  serverUrl,
  role,
  participantUrl,
  roomId,
  hostToken,
  identity,
  onLeave,
  onConnectError,
  onRoomFull,
  onEndCall,
  onRoomEnded,
  onRemoved,
}: CallShellProps): JSX.Element {
  const setPhase = useConnectionStore((s) => s.setPhase);
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const graceSecondsLeft = useConnectionStore((s) => s.graceSecondsLeft);
  const activeSharerId = useParticipantsStore((s) => s.activeSharerId);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);

  useRoomLifecycle({ identity, onRoomEnded, onRemoved });
  useShareState(); // the single share_state → store subscription for the room

  const onRemoveGuest =
    role === 'host'
      ? (targetIdentity: string, name: string): void => setRemoveTarget({ identity: targetIdentity, name })
      : undefined;

  const handleError = useCallback(
    (error: Error): void => {
      // The server denies the join once the maxParticipants backstop is hit; LiveKit surfaces
      // that as a NotAllowed connection error. Matching the structured reason (not the message
      // text) keeps this stable across SDK versions and locales → routes to S1 (room full).
      if (error instanceof ConnectionError && error.reason === ConnectionErrorReason.NotAllowed) {
        onRoomFull();
        return;
      }
      setPhase('failed');
      onConnectError();
    },
    [onRoomFull, onConnectError, setPhase],
  );

  const handleRemoveConfirm = useCallback(async (): Promise<void> => {
    if (!removeTarget) return;
    try {
      await removeParticipant(roomId, hostToken ?? '', removeTarget.identity);
    } finally {
      setRemoveTarget(null);
    }
  }, [removeTarget, roomId, hostToken]);

  return (
    <LiveKitRoom
      token={accessToken}
      serverUrl={serverUrl}
      connect
      audio={isMicOn}
      video={isCamOn}
      onConnected={() => setPhase('connected')}
      onError={handleError}
      onDisconnected={onLeave}
      // Shrink the call area to the left of the chat panel (fixed 340px, right) when it's open, so the
      // grid and the bottom-right controls (host Copy link + Chat) aren't covered by the panel.
      className={clsx(
        'relative flex h-full flex-col overflow-hidden transition-[padding] duration-200',
        isPanelOpen && 'pr-chat-panel',
      )}
    >
      {graceSecondsLeft !== null ? <GraceOverlay secondsLeft={graceSecondsLeft} /> : null}
      <CallStage activeSharerId={activeSharerId} onRemoveGuest={onRemoveGuest} />
      <ControlsBar onLeave={onLeave} onEndCall={onEndCall} role={role} participantUrl={participantUrl} />
      <RoomAudioRenderer />
      {removeTarget ? (
        <RemoveGuestDialog
          name={removeTarget.name}
          onConfirm={() => void handleRemoveConfirm()}
          onCancel={() => setRemoveTarget(null)}
        />
      ) : null}
    </LiveKitRoom>
  );
}
