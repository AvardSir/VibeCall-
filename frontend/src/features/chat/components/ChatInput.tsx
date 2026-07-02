import { useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, FormEvent, JSX, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../shared/ui/Icon';
import { Text } from '../../../shared/ui/Text';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useChatStore } from '../../../stores/useChatStore';
import type { StagedFile } from '../../../stores/useChatStore';
import { ALLOWED_EXTENSIONS, validateStagedFile } from '../lib/validateAttachment';

const MAX_TEXT_LENGTH = 1000;
const COUNTER_THRESHOLD = 900;
const ACCEPT_EXTENSIONS = Array.from(ALLOWED_EXTENSIONS, (e) => '.' + e).join(',');

// Clipboard image blobs often arrive without a usable filename; normalize the name from the MIME
// type so the shared extension-based validation (validateStagedFile) accepts a pasted screenshot.
const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export type ChatInputProps = { onSend: (text: string, files?: StagedFile[]) => void };

export function ChatInput({ onSend }: ChatInputProps): JSX.Element {
  const { t } = useTranslation('chat');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteCounter = useRef(0);
  const stagedAttachments = useChatStore((s) => s.stagedAttachments);
  const addStaged = useChatStore((s) => s.addStaged);
  const removeStaged = useChatStore((s) => s.removeStaged);
  const clearStaged = useChatStore((s) => s.clearStaged);

  const canSend = text.trim().length > 0 || stagedAttachments.length > 0;

  const send = (): void => {
    // Consume the composer synchronously at send time: read the staged files fresh from the store
    // (not the render-time closure, which a rapid double-click/Enter would reuse) and clear both text
    // and staging immediately. Uploads are async, so without this the staged files linger for the
    // whole upload window and every extra click re-sends the same file. onSend has already captured
    // the files array, so clearing the store afterward does not affect the in-flight send.
    const files = useChatStore.getState().stagedAttachments;
    if (text.trim().length === 0 && files.length === 0) return;
    onSend(text, files);
    setText('');
    clearStaged();
    // Clear any staging error (e.g. the "up to 5 files" notice) — it refers to the batch we just
    // sent, so it must not linger over the now-empty composer.
    setError(null);
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    send();
  };

  // Enter sends; Shift+Enter inserts a newline. Ignore Enter mid-IME-composition.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const openFilePicker = (): void => {
    fileInputRef.current?.click();
  };

  const stageFiles = (files: File[]): void => {
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
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>): void => {
    stageFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  // Paste a screenshot / image from the clipboard (Ctrl+V) — stage it like any attachment.
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
    const imageItems = Array.from(e.clipboardData.items).filter(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    );
    if (imageItems.length === 0) return; // no image on the clipboard → let normal text paste through

    e.preventDefault();
    const files: File[] = [];
    for (const item of imageItems) {
      const blob = item.getAsFile();
      if (!blob) continue;
      const ext = IMAGE_EXT_BY_MIME[blob.type];
      // Give the nameless clipboard blob a proper filename so validation accepts it; if the MIME
      // isn't a supported image, pass the blob through so validation surfaces "unsupportedType".
      files.push(
        ext ? new File([blob], `pasted-image-${(pasteCounter.current += 1)}.${ext}`, { type: blob.type }) : blob,
      );
    }
    stageFiles(files);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 px-6 py-3">
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
      <div className="flex items-end gap-3 rounded-[11px] bg-white px-3 py-2 dark:bg-surface">
        <Tooltip label={t('attach')}>
          <button
            type="button"
            aria-label={t('attach')}
            onClick={openFilePicker}
            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-surface-muted dark:hover:text-slate-100"
          >
            <Icon name="attach" className="h-5 w-5" />
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
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          rows={2}
          className="scrollbar-hide flex-1 resize-none bg-transparent text-base font-light text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/25"
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
