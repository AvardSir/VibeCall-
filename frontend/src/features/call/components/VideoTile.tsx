import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { VideoTrack } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';

export type VideoTileProps = {
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  cameraTrackRef: TrackReference | undefined;
};

export function VideoTile({
  name,
  isLocal,
  isCameraEnabled,
  isMicrophoneEnabled,
  cameraTrackRef,
}: VideoTileProps): JSX.Element {
  const { t } = useTranslation('call');
  const label = isLocal ? t('you', { name }) : name;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
      {/* Inline the condition (not a precomputed boolean) so TS narrows `cameraTrackRef`
          to `TrackReference` inside this branch — `VideoTrack` then receives a defined ref. */}
      {isCameraEnabled && cameraTrackRef != null ? (
        <>
          <VideoTrack
            trackRef={cameraTrackRef}
            className={`h-full w-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
          />
          {!isMicrophoneEnabled && (
            <span
              data-testid="corner-mute"
              aria-hidden
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm text-white"
            >
              🔇
            </span>
          )}
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
            {label}
          </span>
        </>
      ) : (
        // Camera off: mic-state icon centered above the name on a dark background — no avatar (FR-14).
        <div className="grid h-full place-items-center">
          <div className="flex flex-col items-center gap-2">
            <span data-testid="center-mic" aria-hidden className="text-4xl text-slate-400">
              {isMicrophoneEnabled ? '🎤' : '🔇'}
            </span>
            <span className="text-sm text-white">{label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
