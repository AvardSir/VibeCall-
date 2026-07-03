import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../shared/lib/apiClient';
import { Button } from '../shared/ui/Button';
import { Text } from '../shared/ui/Text';
import { UnsupportedBrowserNotice } from '../shared/ui/UnsupportedBrowserNotice';

export function LandingPage(): JSX.Element {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleStart = useCallback(async (): Promise<void> => {
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
  }, [navigate]);

  // The initial screen has a single CTA and no input, so Enter should start the call from anywhere
  // on the page (matches the pre-join screen, where Enter submits the join form). Ignore repeats and
  // in-flight requests so a held key can't fire createRoom twice.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Enter' && !e.repeat && !busy) {
        e.preventDefault();
        void handleStart();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, handleStart]);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 text-center">
      {/* FR-31/ES-814: non-blocking unsupported-browser notice on the host's first screen. */}
      <UnsupportedBrowserNotice />
      {/* FR-30: the landing page shows the app name/logo. Wordmark = "КМБ" in the brand accent blue. */}
      <Text tag="h1" size="2xl" weight="bold" className="text-accent">{t('appName')}</Text>
      <Text tag="p" size="md" className="text-text-muted">{t('tagline')}</Text>
      <Button type="button" onClick={() => void handleStart()} disabled={busy}>
        {t('startCall')}
      </Button>
      {error ? <p className="text-sm text-amber-400">{t('startCallError')}</p> : null}
    </div>
  );
}
