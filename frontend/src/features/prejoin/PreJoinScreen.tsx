import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { useDevicePermissions } from './hooks/useDevicePermissions';
import { useNameValidation } from './hooks/useNameValidation';
import { useMediaStore } from '../../stores/useMediaStore';
import { CameraPreview } from './components/CameraPreview';
import { DeviceToggles } from './components/DeviceToggles';
import { DisplayNameInput } from './components/DisplayNameInput';

export type PreJoinScreenProps = {
  onEnter: (name: string) => void;
  submitting?: boolean;
};

export function PreJoinScreen({ onEnter, submitting = false }: PreJoinScreenProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  const { previewStream } = useDevicePermissions();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const { valid, errorKey } = useNameValidation(name);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);
  const micPermission = useMediaStore((s) => s.micPermission);

  const bothDenied = cameraPermission === 'denied' && micPermission === 'denied';

  function handleSubmit(): void {
    setTouched(true);
    if (valid && !submitting) onEnter(name.trim());
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-5 p-8">
      <CameraPreview stream={previewStream} />
      {cameraPermission === 'prompt' ? (
        <p className="text-sm text-slate-400">{t('awaitingPermission')}</p>
      ) : null}
      {cameraPermission === 'denied' && micPermission !== 'denied' ? (
        <p className="text-sm text-amber-400">{t('cameraDenied')}</p>
      ) : null}
      {micPermission === 'denied' && cameraPermission !== 'denied' ? (
        <p className="text-sm text-amber-400">{t('micDenied')}</p>
      ) : null}
      {bothDenied ? (
        <p className="text-sm text-amber-400">{t('bothDenied')}</p>
      ) : null}
      <DeviceToggles />
      <DisplayNameInput
        value={name}
        onChange={setName}
        errorKey={errorKey}
        showError={touched}
      />
      <Button type="button" onClick={handleSubmit} disabled={!valid || submitting}>
        {t('enterCall')}
      </Button>
    </div>
  );
}
