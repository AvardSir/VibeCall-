import type { JSX } from 'react';
import type { TrackReference } from '@livekit/components-react';
import type { CallParticipant } from '../../../shared/types';
import { VideoTile } from './VideoTile';

export type ParticipantTileProps = {
  participant: CallParticipant;
  cameraTrackRef?: TrackReference;
  // Opens the host's remove-guest confirmation for a remote tile. Omitted for a guest viewer.
  onRemoveGuest?: (identity: string, name: string) => void;
};

// Shared per-participant tile used by both the grid and the thumbnail strip so name / camera-off /
// mute / host-remove behavior stay identical. Grid-specific cell layout stays in VideoGrid.
export function ParticipantTile({ participant, cameraTrackRef, onRemoveGuest }: ParticipantTileProps): JSX.Element {
  return (
    <VideoTile
      name={participant.name}
      isLocal={participant.isLocal}
      isCameraEnabled={participant.isCameraEnabled}
      isMicrophoneEnabled={participant.isMicrophoneEnabled}
      isSpeaking={participant.isSpeaking}
      cameraTrackRef={cameraTrackRef}
      onRemove={
        !participant.isLocal && onRemoveGuest
          ? () => onRemoveGuest(participant.identity, participant.name)
          : undefined
      }
    />
  );
}
