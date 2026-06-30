import { useCallback } from 'react';
import type { JSX } from 'react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { ConnectionError, ConnectionErrorReason } from 'livekit-client';
import '@livekit/components-styles';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { useMediaStore } from '../../stores/useMediaStore';
import { OwnTile } from './components/OwnTile';
import { ControlsBar } from './components/ControlsBar';

export type CallShellProps = {
  accessToken: string;
  serverUrl: string;
  displayName: string;
  onLeave: () => void;
  onConnectError: () => void;
  onRoomFull: () => void;
};

export function CallShell({
  accessToken,
  serverUrl,
  displayName,
  onLeave,
  onConnectError,
  onRoomFull,
}: CallShellProps): JSX.Element {
  const setPhase = useConnectionStore((s) => s.setPhase);
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);

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
      className="flex min-h-full flex-col"
    >
      <div className="flex flex-1 items-center justify-center p-6">
        {/* Subtask 3 replaces this single tile with the 2x2 remote grid. */}
        <div className="w-full max-w-2xl">
          <OwnTile displayName={displayName} />
        </div>
      </div>
      <ControlsBar onLeave={onLeave} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
