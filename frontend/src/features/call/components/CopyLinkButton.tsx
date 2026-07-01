import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

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
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted"
      >
        {t('copyLink')}
      </button>
      {state === 'copied' ? (
        <span className="absolute -top-7 whitespace-nowrap text-xs text-emerald-400">
          {t('linkCopied')}
        </span>
      ) : null}
      {state === 'failed' ? (
        <div className="absolute -top-14 w-72 rounded-md bg-surface-muted p-2 text-xs text-slate-200">
          <p>{t('copyFailed')}</p>
          <p className="select-all break-all font-mono">{url}</p>
        </div>
      ) : null}
    </div>
  );
}
