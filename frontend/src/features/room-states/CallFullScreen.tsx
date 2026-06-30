import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Text } from '../../shared/ui/Text';

export type CallFullScreenProps = { onBackToHome: () => void };

export function CallFullScreen({ onBackToHome }: CallFullScreenProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text variant="title">{t('fullTitle')}</Text>
      <Text variant="body">{t('fullBody')}</Text>
      <Button variant="ghost" onClick={onBackToHome}>{t('backToHome')}</Button>
    </div>
  );
}
