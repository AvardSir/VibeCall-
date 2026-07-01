import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../shared/lib/apiClient';
import { Button } from '../shared/ui/Button';
import { Text } from '../shared/ui/Text';

export function LandingPage(): JSX.Element {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleStart(): Promise<void> {
    setError(false);
    setBusy(true);
    const result = await createRoom();
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    // Host token rides in the hash fragment: never sent to the server in the request line
    // or Referer, so the participant URL (without the hash) stays free of the secret.
    navigate(`/r/${result.data.roomId}#h=${result.data.hostToken}`);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('tagline')}</Text>
      <Button type="button" onClick={() => void handleStart()} disabled={busy}>
        {t('startCall')}
      </Button>
      {error ? <p className="text-sm text-amber-400">{t('startCallError')}</p> : null}
    </div>
  );
}
