import type { JSX } from 'react';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import { ParticipantTile } from './ParticipantTile';

export type ThumbnailStripProps = {
  // Forwarded to each tile so a host can still remove a guest while a share is active.
  onRemoveGuest?: (identity: string, name: string) => void;
};

// Horizontal, fixed-height row of camera tiles shown beneath the shared screen. Same participants,
// same order (host-first / join order) and same tile behavior as the grid — just laid out in a strip.
export function ThumbnailStrip({ onRemoveGuest }: ThumbnailStripProps = {}): JSX.Element {
  const participants = useParticipantsStore((s) => s.participants);
  const cameraTracks = useTracks([Track.Source.Camera]);

  const trackByIdentity = new Map<string, TrackReference>(
    cameraTracks.map((ref) => [ref.participant.identity, ref]),
  );

  return (
    <div
      data-testid="thumbnail-strip"
      // justify-center keeps the tiles centered under the shared screen; the parent (LiveKitRoom) already
      // reserves pr-[340px] when the chat panel is open, so centering tracks the shrunken area for free.
      // ≤4 tiles never overflow the width, so justify-center + overflow-x-auto don't clip.
      // Uniform p-4 inset: overflow-x-auto also clips overflow-y, and the active-speaker `ring-4` is drawn
      // OUTSIDE the tile box — without the top inset the ring's top edge was clipped by the strip. The
      // 16px inset on every side leaves room for the 4px ring so the highlight is never cut off.
      className="flex h-32 shrink-0 justify-center gap-2 overflow-x-auto p-4"
    >
      {participants.map((p) => (
        <div key={p.identity} className="aspect-video h-full shrink-0">
          <ParticipantTile
            participant={p}
            cameraTrackRef={trackByIdentity.get(p.identity)}
            onRemoveGuest={onRemoveGuest}
          />
        </div>
      ))}
    </div>
  );
}
