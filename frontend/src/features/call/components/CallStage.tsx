import type { JSX } from 'react';
import { useParticipants } from '../hooks/useParticipants';
import { VideoGrid } from './VideoGrid';
import { ScreenShareView } from './ScreenShareView';
import { ThumbnailStrip } from './ThumbnailStrip';

export type CallStageProps = {
  // Non-null while someone is sharing → the share layout replaces the grid.
  activeSharerId: string | null;
  onRemoveGuest?: (identity: string, name: string) => void;
};

// Presentational layout switch: the video grid, or the shared screen above a thumbnail strip.
export function CallStage({ activeSharerId, onRemoveGuest }: CallStageProps): JSX.Element {
  // Roster sync runs here — the always-mounted, in-room parent of both consumers (VideoGrid / the
  // share layout's ThumbnailStrip). It must NOT live in CallShell (that runs outside the LiveKitRoom
  // provider, so useRoomContext would throw) nor inside VideoGrid alone (unmounted during a share, so
  // the roster would freeze and joins/leaves would stop reaching the strip).
  useParticipants();

  if (activeSharerId !== null) {
    // min-h-0 on this flex-1 column is load-bearing: it lets the share area shrink to its track so
    // the shared <video> (height arrives async from the stream, driving height from width otherwise)
    // stays bounded and never pushes the thumbnail strip below the overflow-hidden fold. Mirrors the
    // grid branch — every flex-1 link in the height chain needs it.
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ScreenShareView />
        </div>
        <ThumbnailStrip onRemoveGuest={onRemoveGuest} />
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <VideoGrid onRemoveGuest={onRemoveGuest} />
    </div>
  );
}
