import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import type { LocalTrackPublication } from 'livekit-client';
import { useSocket } from '../../../shared/hooks/useSocket';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';

const ERROR_DISMISS_MS = 4000;
const GRANT_TIMEOUT_MS = 5000;

export type UseScreenShareResult = {
  isSharing: boolean;
  isBusy: boolean;
  error: string | null;
  toggle: () => void;
};

export function useScreenShare(): UseScreenShareResult {
  const { t } = useTranslation('call');
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const socket = useSocket();
  const localParticipantInfo = useConnectionStore((s) => s.localParticipant);
  const activeSharerId = useParticipantsStore((s) => s.activeSharerId);

  const localIdentity = localParticipantInfo?.identity ?? null;
  const roomId = localParticipantInfo?.roomId ?? '';
  const isSharing = activeSharerId !== null && activeSharerId === localIdentity;
  const isBusy = activeSharerId !== null && activeSharerId !== localIdentity;

  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((message: string): void => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setError(message);
    errorTimer.current = setTimeout(() => setError(null), ERROR_DISMISS_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  // OS/browser "Stop sharing" bar (or any other screen-share unpublish) frees the server slot.
  useEffect(() => {
    if (!isSharing) return;
    const onUnpublished = (publication: LocalTrackPublication): void => {
      if (publication.source === Track.Source.ScreenShare) {
        socket.emit('release_share', { roomName: roomId });
      }
    };
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, onUnpublished);
    };
  }, [isSharing, room, socket, roomId]);

  // Claim → wait for the server's grant/deny. Resolves 'busy' on denial or timeout.
  const requestShare = useCallback((): Promise<'granted' | 'busy'> => {
    return new Promise((resolve) => {
      const onGranted = (): void => {
        cleanup();
        resolve('granted');
      };
      const onDenied = (): void => {
        cleanup();
        resolve('busy');
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve('busy');
      }, GRANT_TIMEOUT_MS);
      function cleanup(): void {
        clearTimeout(timer);
        socket.off('share_granted', onGranted);
        socket.off('share_denied', onDenied);
      }
      socket.on('share_granted', onGranted);
      socket.on('share_denied', onDenied);
      socket.emit('claim_share', { roomName: roomId });
    });
  }, [socket, roomId]);

  const toggle = useCallback((): void => {
    if (isSharing) {
      void localParticipant.setScreenShareEnabled(false);
      socket.emit('release_share', { roomName: roomId });
      return;
    }
    if (isBusy) {
      showError(t('shareBusy'));
      return;
    }
    void (async (): Promise<void> => {
      const outcome = await requestShare();
      if (outcome === 'busy') {
        showError(t('shareBusy'));
        return;
      }
      try {
        const publication = await localParticipant.setScreenShareEnabled(true);
        // A cancelled picker resolves with no publication rather than rejecting — treat as a cancel.
        if (!publication) {
          socket.emit('release_share', { roomName: roomId });
          showError(t('shareError'));
        }
      } catch {
        socket.emit('release_share', { roomName: roomId });
        showError(t('shareError'));
      }
    })();
  }, [isSharing, isBusy, localParticipant, socket, roomId, requestShare, showError, t]);

  return { isSharing, isBusy, error, toggle };
}
