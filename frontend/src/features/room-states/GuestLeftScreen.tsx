import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Text } from '../../shared/ui/Text';

export type GuestLeftScreenProps = { onRejoin: () => void };

export function GuestLeftScreen({ onRejoin }: GuestLeftScreenProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('leftTitle')}</Text>
      <Button variant="ghost" onClick={onRejoin}>{t('rejoin')}</Button>
    </div>
  );
}
