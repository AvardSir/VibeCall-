import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ControlButton } from '../../../shared/ui/ControlButton';
import { Tooltip } from '../../../shared/ui/Tooltip';

export type CopyLinkButtonProps = { url: string };

type CopyState = 'idle' | 'copied' | 'failed';

export function CopyLinkButton({ url }: CopyLinkButtonProps): JSX.Element {
  const { t } = useTranslation('call');
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="relative flex flex-col items-center">
      <Tooltip label={t('copyLink')}>
        <ControlButton icon="link" label={t('copyLink')} onClick={() => void handleCopy()} iconClassName="h-[26px] w-[26px]" />
      </Tooltip>
      {state === 'copied' ? (
        <span className="absolute -top-9 whitespace-nowrap text-xs text-emerald-400">
          {t('linkCopied')}
        </span>
      ) : null}
      {state === 'failed' ? (
        <div className="absolute -top-16 w-72 rounded-md bg-slate-200 p-2 text-xs text-slate-700 dark:bg-surface-muted dark:text-slate-200">
          <p>{t('copyFailed')}</p>
          <p className="select-all break-all font-mono">{url}</p>
        </div>
      ) : null}
    </div>
  );
}
