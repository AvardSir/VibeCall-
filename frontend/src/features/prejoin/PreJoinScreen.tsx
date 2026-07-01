import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Text } from '../../shared/ui/Text';
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

  function handleSubmit(): void {
    setTouched(true);
    if (valid && !submitting) onEnter(name.trim());
  }

  return (
    <div className="mx-auto flex min-h-full flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-[412px] flex-col items-center gap-3 rounded-[12px] bg-slate-100 p-10 dark:bg-surface-elevated">
        <CameraPreview stream={previewStream} />
        <div className="flex w-full flex-col items-center gap-6">
          <Text tag="h1" size="2xl" weight="bold" className="text-slate-900 dark:text-white">
            {t('title')}
          </Text>
          <NameInput value={name} onChange={setName} errorKey={errorKey} showError={touched} />
          <Button type="button" onClick={handleSubmit} disabled={!valid || submitting}>
            {role === 'host' ? t('enterCall') : t('join')}
          </Button>
        </div>
      </div>

      {/* Device toggles + permission notices — not in the Figma card; kept per PRD FR-10/11. */}
      <div className="flex flex-col items-center gap-2">
        <DeviceToggles />
        {cameraPermission === 'prompt' ? (
          <Text size="sm" className="text-text-muted">{t('awaitingPermission')}</Text>
        ) : null}
        {cameraPermission === 'denied' && micPermission !== 'denied' ? (
          <Text size="sm" className="text-amber-400">{t('cameraDenied')}</Text>
        ) : null}
        {micPermission === 'denied' && cameraPermission !== 'denied' ? (
          <Text size="sm" className="text-amber-400">{t('micDenied')}</Text>
        ) : null}
        {bothDenied ? (
          <Text size="sm" className="text-amber-400">{t('bothDenied')}</Text>
        ) : null}
        {error ? (
          <Text size="sm" className="text-amber-400">{t('common:connectError')}</Text>
        ) : null}
      </div>
    </div>
  );
}
