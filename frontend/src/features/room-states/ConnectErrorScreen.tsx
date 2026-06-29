import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';

export type ConnectErrorScreenProps = { onRetry: () => void };

export function ConnectErrorScreen({ onRetry }: ConnectErrorScreenProps): JSX.Element {
  const { t } = useTranslation('common');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">{t('connectError')}</h1>
      <Button variant="ghost" onClick={onRetry}>{t('retry')}</Button>
    </div>
  );
}
