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
  RoomEvent.ActiveSpeakersChanged,
] as const;

function toCallParticipant(participant: Participant, isLocal: boolean): CallParticipant {
  return {
    identity: participant.identity,
    // Token mints `name: displayName` (backend livekitTokens.ts); fall back to identity.
    name: participant.name || participant.identity,
    isLocal,
    isCameraEnabled: participant.isCameraEnabled,
    isMicrophoneEnabled: participant.isMicrophoneEnabled,
    isSpeaking: participant.isSpeaking,
  };
}

export function useParticipants(): void {
  const room = useRoomContext();
  const setParticipants = useParticipantsStore((s) => s.setParticipants);

  useEffect(() => {
    function sync(): void {
      const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
      // Guard against a duplicate identity (shouldn't happen — local and remote sets are disjoint —
      // but dedupe defensively). First occurrence wins, so the local participant takes precedence.
      const unique = new Map<string, Participant>();
      for (const participant of all) {
        if (!unique.has(participant.identity)) unique.set(participant.identity, participant);
      }
      const ordered = [...unique.values()].sort(
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
