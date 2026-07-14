import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaStore } from '../../../stores/useMediaStore';
import { Icon } from '../../../shared/ui/Icon';

export type CameraPreviewProps = { stream: MediaStream | null };

export function CameraPreview({ stream }: CameraPreviewProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  const videoRef = useRef<HTMLVideoElement>(null);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);
  const isMicOn = useMediaStore((s) => s.isMicOn);

  const showVideo = Boolean(isCamOn && cameraPermission === 'granted' && stream);

  // Re-attach on every (re)mount of the <video>, not only when `stream` changes:
  // toggling the camera off unmounts the element and on mounts a fresh one, so the
  // assignment must also depend on `showVideo` or the new element never gets the stream.
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, showVideo]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[12px] bg-slate-200 dark:bg-surface-elevated">
      {showVideo ? (
        // Mirrored local preview (PRD FR-11).
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
        />
      ) : (
        // Camera off / denied: mic-state glyph in a dark pill, matching the in-call camera-off tile.
        <div className="grid h-full place-items-center">
          <div className="rounded-[9px] bg-[rgba(31,34,36,0.5)] p-4">
            <Icon name={isMicOn ? 'micOn' : 'micOff'} className="h-8 w-8 text-white" />
            <span className="sr-only">{t('cameraToggle')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
