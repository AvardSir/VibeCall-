import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { useTracks, VideoTrack } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import { Text } from '../../../shared/ui/Text';

// The shared screen fills the main area with `object-contain` (never cropped) under a persistent
// label. Rendered only while `activeSharerId` is set (CallShell switches to this layout).
export function ScreenShareView(): JSX.Element {
  const { t } = useTranslation('call');
  const activeSharerId = useParticipantsStore((s) => s.activeSharerId);
  const participants = useParticipantsStore((s) => s.participants);
  const localIdentity = useConnectionStore((s) => s.localParticipant?.identity ?? null);
  const shareTracks = useTracks([Track.Source.ScreenShare]);

  const shareTrack: TrackReference | undefined = shareTracks.find(
    (ref) => ref.participant.identity === activeSharerId,
  );
  const sharerName = participants.find((p) => p.identity === activeSharerId)?.name ?? '';
  const label =
    activeSharerId !== null && activeSharerId === localIdentity
      ? t('youAreSharing')
      : t('sharingLabel', { name: sharerName });

  return (
    <div className="relative flex h-full w-full items-center justify-center p-6">
      <span className="absolute left-4 top-4 z-10 rounded bg-black/60 px-3 py-1">
        <Text size="sm" className="text-white">
          {label}
        </Text>
      </span>
      {shareTrack ? (
        <VideoTrack trackRef={shareTrack} className="max-h-full max-w-full object-contain" />
      ) : (
        <div data-testid="share-placeholder" className="h-full w-full rounded-xl bg-black" />
      )}
      {participants.length === 1 && (
        // Lone host sharing (ES-HostAlone): keep the "waiting for someone to join" notice visible
        // as a centered overlay even in the screen-share layout.
        <p
          data-testid="waiting-notice"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white"
        >
          {t('waiting')}
        </p>
      )}
    </div>
  );
}
