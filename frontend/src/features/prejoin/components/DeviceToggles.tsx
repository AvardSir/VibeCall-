import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ControlButton } from '../../../shared/ui/ControlButton';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useMediaStore } from '../../../stores/useMediaStore';

export function DeviceToggles(): JSX.Element {
  // Reuse the in-call control tooltip strings so the pre-join mic/cam controls
  // are visually and textually identical to the ones in the call.
  const { t } = useTranslation('call');
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const micPermission = useMediaStore((s) => s.micPermission);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);

  const micLabel = isMicOn ? t('micTooltipOn') : t('micTooltipOff');
  const camLabel = isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff');

  return (
    <div className="flex items-center justify-center gap-4">
      <Tooltip label={micLabel}>
        <ControlButton
          icon={isMicOn ? 'micOn' : 'micOff'}
          label={micLabel}
          disabled={micPermission === 'denied'}
          onClick={() => setMicOn(!isMicOn)}
        />
      </Tooltip>
      <Tooltip label={camLabel}>
        <ControlButton
          icon={isCamOn ? 'camOn' : 'camOff'}
          label={camLabel}
          disabled={cameraPermission === 'denied'}
          onClick={() => setCamOn(!isCamOn)}
        />
      </Tooltip>
    </div>
  );
}
