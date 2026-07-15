import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Text } from '../../shared/ui/Text';
import { UnsupportedBrowserNotice } from '../../shared/ui/UnsupportedBrowserNotice';
import { useDevicePermissions } from './hooks/useDevicePermissions';
import { validateName } from './nameValidation';
import { useMediaStore } from '../../stores/useMediaStore';
import type { ParticipantRole } from '../../shared/types';
import { CameraPreview } from './components/CameraPreview';
import { DeviceToggles } from './components/DeviceToggles';
import { NameInput } from './components/NameInput';

export type PreJoinScreenProps = {
  onEnter: (name: string) => void;
  submitting?: boolean;
  role?: ParticipantRole;
  error?: boolean;
};

export function PreJoinScreen({ onEnter, submitting = false, role = 'guest', error = false }: PreJoinScreenProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  const { previewStream } = useDevicePermissions();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const { valid, errorKey } = validateName(name);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);
  const micPermission = useMediaStore((s) => s.micPermission);

  const bothDenied = cameraPermission === 'denied' && micPermission === 'denied';

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setTouched(true);
    if (valid && !submitting) onEnter(name.trim());
  }

  return (
    <div className="mx-auto flex min-h-full flex-col items-center justify-center p-4">
      {/* PRD/wireframe (H2) layout: a wider card with a large full-width camera preview, the device
          toggles + permission notices, then the name field and CTA — all inside one card. */}
      <div className="flex w-[560px] flex-col gap-4 rounded-[12px] bg-slate-100 p-8 dark:bg-surface-elevated">
        {/* FR-31/ES-814: non-blocking unsupported-browser notice on the guest's first screen. */}
        <UnsupportedBrowserNotice />
        <CameraPreview stream={previewStream} />
        <DeviceToggles />

        {/* Permission notices sit under the toggles (PRD FR-10/11). */}
        {cameraPermission === 'prompt' ? (
          <Text size="sm" className="text-center text-text-muted">{t('awaitingPermission')}</Text>
        ) : null}
        {cameraPermission === 'denied' && micPermission !== 'denied' ? (
          <Text size="sm" className="text-center text-warning">{t('cameraDenied')}</Text>
        ) : null}
        {micPermission === 'denied' && cameraPermission !== 'denied' ? (
          <Text size="sm" className="text-center text-warning">{t('micDenied')}</Text>
        ) : null}
        {bothDenied ? (
          <Text size="sm" className="text-center text-warning">{t('bothDenied')}</Text>
        ) : null}
        {error ? (
          <Text size="sm" className="text-center text-warning">{t('common:connectError')}</Text>
        ) : null}

        <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-4">
          <Text tag="h1" size="2xl" weight="bold" className="text-slate-900 dark:text-white">
            {t('title')}
          </Text>
          <NameInput value={name} onChange={setName} errorKey={errorKey} showError={touched} />
          {/* Match the name field's width (332px). Button is enabled even when the name is invalid so
              the click/Enter surfaces the specific error (PRD: "Error appears on the Enter call/Join
              click"); handleSubmit gates the actual entry. */}
          <div className="w-[332px]">
            <Button type="submit" fullWidth disabled={submitting}>
              {role === 'host' ? t('enterCall') : t('join')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
