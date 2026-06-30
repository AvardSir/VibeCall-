import { useEffect } from 'react';
import { RoomEvent } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import type { CallParticipant } from '../../../shared/types';

const SYNC_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
] as const;

function toCallParticipant(participant: Participant, isLocal: boolean): CallParticipant {
  return {
    identity: participant.identity,
    // Token mints `name: displayName` (backend livekitTokens.ts); fall back to identity.
    name: participant.name || participant.identity,
    isLocal,
    isCameraEnabled: participant.isCameraEnabled,
    isMicrophoneEnabled: participant.isMicrophoneEnabled,
  };
}

export function useParticipants(): void {
  const room = useRoomContext();
  const setParticipants = useParticipantsStore((s) => s.setParticipants);

  useEffect(() => {
    function sync(): void {
      const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
      const ordered = [...all].sort(
        (a, b) => (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0),
      );
      setParticipants(ordered.map((p) => toCallParticipant(p, p === room.localParticipant)));
    }

    sync();
    SYNC_EVENTS.forEach((event) => room.on(event, sync));
    return () => {
      SYNC_EVENTS.forEach((event) => room.off(event, sync));
    };
  }, [room, setParticipants]);
}
