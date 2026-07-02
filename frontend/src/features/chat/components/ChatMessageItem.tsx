import type { JSX } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ChatItem } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import { attachmentDownloadUrl } from '../../../shared/lib/apiClient';
import type { Attachment } from '../../../shared/types';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { FileChip } from './FileChip';

export type ChatMessageItemProps = {
  item: ChatItem;
  isOwn: boolean;
  isFirstInGroup: boolean;
  onOpenImage?: (src: string, alt: string) => void;
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isAnimated(mime: string): boolean {
  return mime === 'image/gif' || mime === 'image/webp';
}

export function ChatMessageItem({ item: m, isOwn, isFirstInGroup, onOpenImage }: ChatMessageItemProps): JSX.Element {
  const { t } = useTranslation('chat');
  const memberToken = useConnectionStore((s) => s.localParticipant?.memberToken ?? '');

  function attachmentSrc(a: Attachment): string {
    return a.url.startsWith('blob:') ? a.url : attachmentDownloadUrl(a, memberToken);
  }

  // Audit §3: first bubble in a sender group = full 12px radius; subsequent bubbles cut the inner
  // BOTTOM corner to 4px (others → bottom-left, own → bottom-right).
  const radius = isFirstInGroup
    ? 'rounded-[12px]'
    : clsx('rounded-[12px]', isOwn ? 'rounded-br-[4px]' : 'rounded-bl-[4px]');

  // Figma (audit §5, nodes 50:4178 / 63:3131): the first bubble in a sender group carries the sender
  // name as its own top row INSIDE the bubble — name + body combined in one bubble, gap-[4px].
  // Subsequent bubbles omit the name.
  const nameRow = isFirstInGroup ? (
    <div className={clsx('mb-1 text-sm font-semibold leading-[18px]', isOwn ? 'text-accent' : 'text-sender')}>
      {m.senderName}
    </div>
  ) : null;

  return (
    <li className={isOwn ? 'self-end text-right' : 'self-start text-left'}>
      {m.text !== '' ? (
        <div
          data-testid="chat-text"
          className={clsx(
            'inline-block max-w-[280px] whitespace-pre-wrap break-words bg-white px-3 py-2.5 text-left dark:bg-surface',
            radius,
          )}
        >
          {nameRow}
          <span data-testid="chat-text-body" className="text-sm font-light leading-[18px] text-slate-900 dark:text-white">
            {m.text}
          </span>
          <span data-testid="chat-timestamp" className="text-sm text-slate-500 dark:text-white/50">
            {' · '}
            {formatTime(m.sentAt)}
          </span>
        </div>
      ) : (
        // Attachment-only message: no text bubble — keep the sender name above the attachments.
        nameRow
      )}
      {m.attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {m.attachments.map((a) => {
            const src = attachmentSrc(a);
            return a.kind === 'image' ? (
              <AttachmentThumbnail
                key={a.fileId}
                src={src}
                name={a.name}
                animated={isAnimated(a.mime)}
                onOpen={() => onOpenImage?.(src, a.name)}
              />
            ) : (
              <FileChip key={a.fileId} name={a.name} size={a.size} href={src} downloadLabel={t('download')} />
            );
          })}
        </div>
      )}
      {isOwn && m.status === 'sending' && <div className="text-xs text-slate-500">{t('sending')}</div>}
      {isOwn && m.status === 'failed' && <div className="text-xs text-red-400">{t('notDelivered')}</div>}
    </li>
  );
}
