import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { useConnectionStore } from '../../../stores/useConnectionStore';
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

// Per-count sizing of the whole grid box. Each box keeps a fixed aspect ratio so that once split into
// 1fr cells every cell comes out ~16:9 and the tiles (which fill their cells) stay ~16:9 without
// letterboxing: 2-up is one row of two 16:9 tiles → ~32:9; 1/3/4-up stack two 16:9-ish rows → 16:9.
//
// The call area (below the controls bar) is wider than 16:9, so for the 16:9 boxes (1/3/4-up) the
// limiting dimension is HEIGHT — we size them height-first (`h-full` → width derived from the ratio,
// `max-w-full` guards the rare narrower-than-16:9 viewport) so the box fills the vertical space and
// the tiles grow as large as fit. 2-up is a very wide 32:9 box (two 16:9 tiles side by side) that is
// genuinely width-limited, so it stays width-first (`w-full`, capped to the Figma 1382px, `max-h-full`
// prevents overflow); its short height is inherent to the side-by-side layout, not dead space.
const GRID_SIZING: Record<number, string> = {
  1: 'h-full aspect-video max-w-full',
  2: 'w-full aspect-[32/9] max-h-full max-w-[1382px]',
  3: 'h-full aspect-video max-w-full',
  4: 'h-full aspect-video max-w-full',
};

export type VideoGridProps = {
  // Opens the remove-guest confirmation for a remote tile. Omitted entirely for a guest viewer —
  // only the host can remove participants (mirrors the M3 role-gated CopyLinkButton pattern).
  onRemoveGuest?: (identity: string, name: string) => void;
};

export function VideoGrid({ onRemoveGuest }: VideoGridProps = {}): JSX.Element {
  const { t } = useTranslation('call');
  // Roster sync now lives in CallStage (the always-mounted in-room parent); this component only reads.
  const participants = useParticipantsStore((s) => s.participants);
  // During host grace the GraceOverlay banner is shown instead; suppress the "waiting" notice so the
  // guest does not see both "Waiting for someone to join…" and "The host lost connection…" at once.
  const inGrace = useConnectionStore((s) => s.graceSecondsLeft !== null);
  const cameraTracks = useTracks([Track.Source.Camera]);

  const trackByIdentity = new Map<string, TrackReference>(
    cameraTracks.map((ref) => [ref.participant.identity, ref]),
  );

  const count = participants.length;
  const layout = GRID_LAYOUT[count] ?? 'grid-cols-2 grid-rows-2';
  const sizing = GRID_SIZING[count] ?? 'h-full aspect-video max-w-full';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6">
      <div
        data-testid="video-grid"
        data-count={count}
        // The box holds a fixed aspect ratio (see GRID_SIZING); the 16:9 counts fill the available
        // height (height-first), 2-up fills the available width. The block centers via the parent flex.
        // 1fr cells + filling tiles → the spacing between tiles is exactly the gap-4, equal on both axes.
        className={`grid min-h-0 min-w-0 gap-4 ${sizing} ${layout}`}
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
      {count === 1 && !inGrace && (
        // Lone-host notice: a CENTERED overlay on the single tile (ES-HostAlone), not a bottom pill.
        <p
          data-testid="waiting-notice"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white"
        >
          {t('waiting')}
        </p>
      )}
    </div>
  );
}
