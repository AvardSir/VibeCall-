import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import { ParticipantTile } from './ParticipantTile';

// Layout per FR-13: 1 → full; 2 → left/right; 3 → two top + one centered bottom; 4 → 2×2.
// Tracks are `1fr` so cells fill the grid box evenly; the tiles then FILL their cell (no letterbox),
// so the only spacing between tiles is the uniform `gap-4` — identical vertically and horizontally.
const GRID_LAYOUT: Record<number, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-1',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
};

// Per-count aspect ratio of the whole grid box, so that once split into 1fr cells each cell comes out
// ~16:9 and the tiles (which fill their cells) stay ~16:9 without letterboxing: 2-up is one row of two
// 16:9 tiles → ~32:9; 1/3/4-up stack two 16:9-ish rows → 16:9. The box is sized from its definite
// width (w-full, capped) with the height derived from this ratio; `max-h-full` prevents overflow.
const GRID_ASPECT: Record<number, string> = {
  1: 'aspect-video',
  2: 'aspect-[32/9]',
  3: 'aspect-video',
  4: 'aspect-video',
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
  // Roster sync now lives in CallShell (runs in both grid and share layouts); this component only reads.
  const participants = useParticipantsStore((s) => s.participants);
  const cameraTracks = useTracks([Track.Source.Camera]);

  const trackByIdentity = new Map<string, TrackReference>(
    cameraTracks.map((ref) => [ref.participant.identity, ref]),
  );

  const count = participants.length;
  const layout = GRID_LAYOUT[count] ?? 'grid-cols-2 grid-rows-2';
  const aspect = GRID_ASPECT[count] ?? 'aspect-video';
  const maxWidth = GRID_MAX_WIDTH[count] ?? 'max-w-[1168px]';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6">
      <div
        data-testid="video-grid"
        data-count={count}
        // w-full (capped) is the definite basis; aspect derives the height; max-h-full bounds it to the
        // viewport (no overflow). The block centers via the parent flex. 1fr cells + filling tiles → the
        // spacing between tiles is exactly the gap-4, equal on both axes.
        className={`grid min-h-0 w-full ${aspect} max-h-full gap-4 ${maxWidth} ${layout}`}
      >
        {participants.map((p, index) => {
          // 3-up: the third tile spans both columns and centers (half width), so it sits under the gap
          // between the two top tiles (FR-13). Every tile fills its cell; VideoTile is h-full w-full.
          const centerBottom = count === 3 && index === 2 ? 'col-span-2 w-1/2 justify-self-center' : '';
          return (
            <div key={p.identity} className={`min-h-0 min-w-0 ${centerBottom}`}>
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
