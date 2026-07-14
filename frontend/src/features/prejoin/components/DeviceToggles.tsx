import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../../shared/ui/Toggle';
import { useMediaStore } from '../../../stores/useMediaStore';

export function DeviceToggles(): JSX.Element {
  const { t } = useTranslation('prejoin');
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const micPermission = useMediaStore((s) => s.micPermission);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);

  return (
    <div className="flex gap-3">
      <Toggle
        label={t('micToggle')}
        pressed={isMicOn}
        disabled={micPermission === 'denied'}
        onChange={setMicOn}
      />
      <Toggle
        label={t('cameraToggle')}
        pressed={isCamOn}
        disabled={cameraPermission === 'denied'}
        onChange={setCamOn}
      />
    </div>
  );
}
