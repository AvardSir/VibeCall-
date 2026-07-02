import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { useParticipants } from '../hooks/useParticipants';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import { VideoTile } from './VideoTile';

// Layout per FR-13: 1 → full; 2 → left/right; 3 → two top + one centered bottom;
// 4 → 2×2. The 3-up case uses a 2×2 grid where the third tile spans and centers.
const GRID_LAYOUT: Record<number, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-1',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
};

export function VideoGrid(): JSX.Element {
  const { t } = useTranslation('call');
  useParticipants();
  const participants = useParticipantsStore((s) => s.participants);
  const cameraTracks = useTracks([Track.Source.Camera]);

  const trackByIdentity = new Map<string, TrackReference>(
    cameraTracks.map((ref) => [ref.participant.identity, ref]),
  );

  const count = participants.length;
  const layout = GRID_LAYOUT[count] ?? 'grid-cols-2 grid-rows-2';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6">
      <div data-testid="video-grid" data-count={count} className={`grid h-full w-full max-w-5xl gap-3 ${layout}`}>
        {participants.map((p, index) => {
          const centerBottom =
            count === 3 && index === 2 ? 'col-span-2 w-1/2 justify-self-center' : '';
          return (
            <div key={p.identity} className={`min-h-0 ${centerBottom}`}>
              <VideoTile
                name={p.name}
                isLocal={p.isLocal}
                isCameraEnabled={p.isCameraEnabled}
                isMicrophoneEnabled={p.isMicrophoneEnabled}
                cameraTrackRef={trackByIdentity.get(p.identity)}
              />
            </div>
          );
        })}
      </div>
      {count === 1 && (
        <p className="absolute bottom-24 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {t('waiting')}
        </p>
      )}
    </div>
  );
}
