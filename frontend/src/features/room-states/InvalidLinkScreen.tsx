import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '../../shared/ui/Text';
import { LinkButton } from '../../shared/ui/LinkButton';

export function InvalidLinkScreen(): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('notFoundTitle')}</Text>
      <Text tag="p" className="text-slate-400">{t('notFoundBody')}</Text>
      <LinkButton to="/">{t('startNewCall')}</LinkButton>
    </div>
  );
}
