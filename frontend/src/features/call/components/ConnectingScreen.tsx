import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../../shared/ui/Spinner';

export function ConnectingScreen(): JSX.Element {
  const { t } = useTranslation('common');
  return (
    <div className="grid min-h-full place-items-center">
      <Spinner label={t('connecting')} />
    </div>
  );
}
