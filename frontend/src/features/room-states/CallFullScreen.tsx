import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Text } from '../../shared/ui/Text';

export type CallFullScreenProps = { onBackToHome: () => void };

export function CallFullScreen({ onBackToHome }: CallFullScreenProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('fullTitle')}</Text>
      <Text tag="p" className="text-slate-400">{t('fullBody')}</Text>
      <Button variant="primary" onClick={onBackToHome}>{t('backToHome')}</Button>
    </div>
  );
}
