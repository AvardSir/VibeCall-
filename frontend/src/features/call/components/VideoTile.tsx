import type { JSX } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { VideoTrack } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { Icon } from '../../../shared/ui/Icon';

export type VideoTileProps = {
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isSpeaking?: boolean;
  cameraTrackRef: TrackReference | undefined;
  onRemove?: () => void;
};

export function VideoTile({
  name,
  isLocal,
  isCameraEnabled,
  isMicrophoneEnabled,
  isSpeaking,
  cameraTrackRef,
  onRemove,
}: VideoTileProps): JSX.Element {
  const { t } = useTranslation('call');
  const label = isLocal ? t('you', { name }) : name;

  return (
    <div
      data-speaking={isSpeaking ? 'true' : undefined}
      className={clsx(
        // Camera-off fill: grey in light theme (like the chat surfaces), dark in dark theme. The
        // overlaid name/mic pills are semi-transparent dark and stay readable on either fill.
        'group relative h-full w-full overflow-hidden rounded-[12px] bg-slate-200 dark:bg-surface-elevated',
        // Active-speaker highlight (project accent blue) — the design has no green.
        isSpeaking && 'ring-4 ring-accent',
      )}
    >
      {onRemove ? (
        <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
          <Tooltip label={t('removeGuestTooltip')}>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg bg-black/60 px-3 py-1 text-xs font-medium text-white transition hover:bg-black/80"
            >
              {t('removeGuest')}
            </button>
          </Tooltip>
        </div>
      ) : null}
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
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-[rgba(31,34,36,0.5)]"
            >
              <Icon name="micOff" className="h-4 w-4 text-white" />
            </span>
          )}
          <span
            data-testid="name-label"
            className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-[9px] bg-[rgba(31,34,36,0.5)] py-1 pl-1.5 pr-2.5"
          >
            <Icon name={isMicrophoneEnabled ? 'micOn' : 'micOff'} className="h-5 w-5 text-white" />
            <span className="text-sm font-light text-white">{label}</span>
          </span>
        </>
      ) : (
        // Camera off: mic-state glyph centered above the name on a dark background — no avatar (FR-14).
        <div className="grid h-full place-items-center">
          <div className="flex flex-col items-center gap-2 rounded-[9px] bg-[rgba(31,34,36,0.5)] px-4 py-3">
            <span data-testid="center-mic">
              <Icon name={isMicrophoneEnabled ? 'micOn' : 'micOff'} className="h-8 w-8 text-white" />
            </span>
            <span className="text-xl font-extrabold leading-[28px] text-white">{label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
