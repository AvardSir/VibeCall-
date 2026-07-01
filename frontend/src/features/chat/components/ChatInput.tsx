import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../shared/ui/Icon';
import { Text } from '../../../shared/ui/Text';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useChatStore } from '../../../stores/useChatStore';
import type { StagedFile } from '../../../stores/useChatStore';
import { validateStagedFile } from '../lib/validateAttachment';

const MAX_TEXT_LENGTH = 1000;
const COUNTER_THRESHOLD = 900;
const ACCEPT_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';

export type ChatInputProps = { onSend: (text: string, files?: StagedFile[]) => void };

export function ChatInput({ onSend }: ChatInputProps): JSX.Element {
  const { t } = useTranslation('chat');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stagedAttachments = useChatStore((s) => s.stagedAttachments);
  const addStaged = useChatStore((s) => s.addStaged);
  const removeStaged = useChatStore((s) => s.removeStaged);

  const canSend = text.trim().length > 0 || stagedAttachments.length > 0;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!canSend) return;
    onSend(text, stagedAttachments);
    setText('');
  };

  const openFilePicker = (): void => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    let stagedInBatch = 0;
    let latestError: string | null = null;

    for (const file of files) {
      const currentCount = useChatStore.getState().stagedAttachments.length + stagedInBatch;
      const result = validateStagedFile(file, currentCount);
      if (result.ok) {
        addStaged(file);
        stagedInBatch += 1;
        latestError = null;
      } else {
        latestError = t(result.errorKey);
      }
    }

    setError(latestError);
    e.target.value = '';
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 p-3">
      {stagedAttachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {stagedAttachments.map((staged) => (
            <li
              key={staged.id}
              className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700 dark:bg-surface-muted dark:text-slate-200"
            >
              <Text size="xs" className="max-w-[10rem] truncate">
                {staged.file.name}
              </Text>
              <button
                type="button"
                aria-label={`${t('removeAttachment')}: ${staged.file.name}`}
                onClick={() => removeStaged(staged.id)}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-3 rounded-[11px] bg-white px-3 py-2 hover:border hover:border-slate-300 dark:bg-surface dark:hover:border-white/25">
        <Tooltip label={t('attach')}>
          <button
            type="button"
            aria-label={t('attach')}
            onClick={openFilePicker}
            className="rounded-lg px-2 py-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-surface-muted dark:hover:text-slate-100"
          >
            📎
          </button>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_EXTENSIONS}
          data-testid="attach-input"
          onChange={handleFilesSelected}
          className="hidden"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
          placeholder={t('placeholder')}
          rows={2}
          className="flex-1 resize-none bg-transparent text-base font-light text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/25"
        />
        <button
          type="submit"
          aria-label={t('send')}
          disabled={!canSend}
          className="shrink-0 disabled:opacity-40"
        >
          <Icon name="send" className="h-[34px] w-[34px] text-accent" />
        </button>
      </div>
      {error && (
        <Text size="xs" className="text-red-400">
          {error}
        </Text>
      )}
      {text.length >= COUNTER_THRESHOLD && (
        <span className="self-end text-xs text-slate-500">{t('charCount', { length: text.length })}</span>
      )}
    </form>
  );
}
