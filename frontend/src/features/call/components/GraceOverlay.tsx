import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../shared/ui/Text';

export type GraceOverlayProps = { secondsLeft: number };

export function GraceOverlay({ secondsLeft }: GraceOverlayProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 top-4 z-20 mx-auto flex max-w-md flex-col items-center gap-1 rounded-lg bg-surface-elevated/90 p-4 text-center"
    >
      <Text tag="p" weight="medium" className="text-slate-100">
        {t('graceOverlay')}
      </Text>
      <Text tag="p" size="sm" className="text-slate-300">
        {t('graceCountdown', { n: secondsLeft })}
      </Text>
    </div>
  );
}
