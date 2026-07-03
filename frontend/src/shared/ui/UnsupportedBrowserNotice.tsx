import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { isBrowserSupported } from '../lib/detectBrowser';
import { Text } from './Text';

// FR-31 / ES-814: an informational, NON-blocking notice shown on the first screen when the current
// browser is outside the supported set. It never gates the flow — the user may continue at own risk.
export function UnsupportedBrowserNotice(): JSX.Element | null {
  const { t } = useTranslation('roomStates');
  if (isBrowserSupported()) return null;
  return (
    <div
      role="status"
      className="w-full rounded-[8px] border border-warning/40 bg-warning/10 px-4 py-3 text-center"
    >
      <Text size="sm" className="text-warning">{t('unsupportedBrowser')}</Text>
    </div>
  );
}
