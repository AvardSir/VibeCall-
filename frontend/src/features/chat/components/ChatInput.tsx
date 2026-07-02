import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';

const MAX_TEXT_LENGTH = 1000;
const COUNTER_THRESHOLD = 900;

export type ChatInputProps = { onSend: (text: string) => void };

export function ChatInput({ onSend }: ChatInputProps): JSX.Element {
  const { t } = useTranslation('chat');
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 border-t border-surface-muted p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
          placeholder={t('placeholder')}
          rows={2}
          className="flex-1 resize-none rounded-lg bg-surface-muted px-3 py-2 text-sm text-slate-100 outline-none"
        />
        <Button type="submit" disabled={!canSend}>
          {t('send')}
        </Button>
      </div>
      {text.length >= COUNTER_THRESHOLD && (
        <span className="self-end text-xs text-slate-500">{t('charCount', { length: text.length })}</span>
      )}
    </form>
  );
}
