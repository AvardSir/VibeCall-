import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ControlButton } from '../../../shared/ui/ControlButton';
import { Tooltip } from '../../../shared/ui/Tooltip';

export type CopyLinkButtonProps = { url: string };

type CopyState = 'idle' | 'copied' | 'failed';

// Copy resiliently: prefer the async Clipboard API, but fall back to a transient hidden-textarea +
// execCommand when it is unavailable or rejects (seen with keyboard activation / non-secure contexts).
// Returns whether the copy succeeded so the caller can show the right feedback.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy fallback
  }
  try {
    if (typeof document.queryCommandSupported === 'function' && document.queryCommandSupported('copy')) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  } catch {
    // ignore — reported as failure below
  }
  return false;
}

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
    if (await copyToClipboard(url)) {
      setState('copied');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setState('idle'), 2000);
    } else {
      setState('failed');
    }
  }

  return (
    <div className="relative flex flex-col items-center">
      <Tooltip label={t('copyLink')} suppressed={state !== 'idle'}>
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
