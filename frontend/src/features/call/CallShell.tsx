import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
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
  const { t } = useTranslation('common');
  const setPhase = useConnectionStore((s) => s.setPhase);
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);

  function handleError(error: Error): void {
    // LiveKit rejects the surplus participant from the maxParticipants backstop → S1.
    if (/full|exceeds|maximum|capacity/i.test(error.message)) {
      onRoomFull();
      return;
    }
    setPhase('failed');
    onConnectError();
  }

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
      <div className="flex flex-1 items-center justify-center p-6" aria-label={t('appName')}>
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
