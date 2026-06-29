import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';

export type CallFullScreenProps = { onBackToHome: () => void };

export function CallFullScreen({ onBackToHome }: CallFullScreenProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">{t('fullTitle')}</h1>
      <p className="text-slate-400">{t('fullBody')}</p>
      <Button variant="ghost" onClick={onBackToHome}>{t('backToHome')}</Button>
    </div>
  );
}
