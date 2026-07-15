import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Text } from '../../shared/ui/Text';

export type GuestLeftScreenProps = { onRejoin: () => void; onBackToHome: () => void };

export function GuestLeftScreen({ onRejoin, onBackToHome }: GuestLeftScreenProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('leftTitle')}</Text>
      {/* Fixed-width column so both actions render at the SAME width (fullWidth stretches each to the
          column). Both use the accent (primary) style — matching the pre-join "Join" button. The PRD
          lists only Rejoin here; "Back to home" is a small, deliberate addition (→ landing → "Start a
          call" = become host) so a guest who left is not stranded. */}
      <div className="flex w-full max-w-[240px] flex-col gap-3">
        <Button variant="primary" fullWidth onClick={onRejoin}>{t('rejoin')}</Button>
        <Button variant="primary" fullWidth onClick={onBackToHome}>{t('backToHome')}</Button>
      </div>
    </div>
  );
}
