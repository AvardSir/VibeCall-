import type { JSX } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalParticipant } from '@livekit/components-react';
import { Toggle } from '../../../shared/ui/Toggle';
import { Button } from '../../../shared/ui/Button';
import { useMediaStore } from '../../../stores/useMediaStore';

export type ControlsBarProps = { onLeave: () => void };

export function ControlsBar({ onLeave }: ControlsBarProps): JSX.Element {
  const { t } = useTranslation('call');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);

  // Reconcile published tracks with the store's desired state.
  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(isMicOn);
  }, [localParticipant, isMicOn]);

  useEffect(() => {
    void localParticipant.setCameraEnabled(isCamOn);
  }, [localParticipant, isCamOn]);

  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <Toggle label={t('micToggle')} pressed={isMicOn} onChange={setMicOn} />
      <Toggle label={t('cameraToggle')} pressed={isCamOn} onChange={setCamOn} />
      <Button variant="ghost" onClick={onLeave}>
        {t('leave')}
      </Button>
    </div>
  );
}
