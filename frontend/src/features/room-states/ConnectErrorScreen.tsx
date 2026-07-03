import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Text } from '../../shared/ui/Text';

export type ConnectErrorScreenProps = { onRetry: () => void };

export function ConnectErrorScreen({ onRetry }: ConnectErrorScreenProps): JSX.Element {
  const { t } = useTranslation('common');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('connectError')}</Text>
      <Button variant="primary" onClick={onRetry}>{t('retry')}</Button>
    </div>
  );
}
