import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { useParticipants } from '../hooks/useParticipants';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import { ParticipantTile } from './ParticipantTile';

// Layout per FR-13: 1 → full; 2 → left/right; 3 → two top + one centered bottom;
// 4 → 2×2. The 3-up case uses a 2×2 grid where the third tile spans and centers.
const GRID_LAYOUT: Record<number, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-1',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
};

// Per-count content width caps (Figma V2 room grids — audit §4/§5 item 7):
// 1-up 1220px, 2-up 1382px, 3-up/4-up 1168px (4-up reuses V1 geometry).
const GRID_MAX_WIDTH: Record<number, string> = {
  1: 'max-w-[1220px]',
  2: 'max-w-[1382px]',
  3: 'max-w-[1168px]',
  4: 'max-w-[1168px]',
};

export type VideoGridProps = {
  // Opens the remove-guest confirmation for a remote tile. Omitted entirely for a guest viewer —
  // only the host can remove participants (mirrors the M3 role-gated CopyLinkButton pattern).
  onRemoveGuest?: (identity: string, name: string) => void;
};

export function VideoGrid({ onRemoveGuest }: VideoGridProps = {}): JSX.Element {
  const { t } = useTranslation('call');
  useParticipants();
  const participants = useParticipantsStore((s) => s.participants);
  const cameraTracks = useTracks([Track.Source.Camera]);

  const trackByIdentity = new Map<string, TrackReference>(
    cameraTracks.map((ref) => [ref.participant.identity, ref]),
  );

  const count = participants.length;
  const layout = GRID_LAYOUT[count] ?? 'grid-cols-2 grid-rows-2';
  const maxWidth = GRID_MAX_WIDTH[count] ?? 'max-w-[1168px]';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6">
      <div
        data-testid="video-grid"
        data-count={count}
        className={`grid h-full w-full gap-4 ${maxWidth} ${layout}`}
      >
        {participants.map((p, index) => {
          const centerBottom =
            count === 3 && index === 2 ? 'col-span-2 w-1/2 justify-self-center' : '';
          return (
            <div key={p.identity} className={`aspect-video min-h-0 ${centerBottom}`}>
              <ParticipantTile
                participant={p}
                cameraTrackRef={trackByIdentity.get(p.identity)}
                onRemoveGuest={onRemoveGuest}
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
