import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Text } from '../../shared/ui/Text';

export function CallEndedScreen(): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('endedTitle')}</Text>
      <Link
        to="/"
        className="rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted"
      >
        {t('startNewCall')}
      </Link>
    </div>
  );
}
