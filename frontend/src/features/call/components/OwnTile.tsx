import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { VideoTrack, useLocalParticipant, useTracks } from '@livekit/components-react';
import { useMediaStore } from '../../../stores/useMediaStore';

export type OwnTileProps = { displayName: string };

export function OwnTile({ displayName }: OwnTileProps): JSX.Element {
  const { t } = useTranslation('call');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const cameraTracks = useTracks([Track.Source.Camera]).filter(
    (ref) => ref.participant.identity === localParticipant.identity,
  );
  const cameraRef = cameraTracks[0];
  const showVideo = cameraRef?.publication != null && !cameraRef.publication.isMuted;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {showVideo ? (
        <VideoTrack trackRef={cameraRef} className="h-full w-full -scale-x-100 object-cover" />
      ) : (
        // Camera off: mic-state icon on dark background, no avatar (PRD FR-14).
        <div className="grid h-full place-items-center text-slate-400">
          <span className="text-4xl">{isMicOn ? '🎤' : '🔇'}</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {t('you', { name: displayName })}
      </span>
    </div>
  );
}
