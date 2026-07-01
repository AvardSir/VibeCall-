import type { JSX } from 'react';
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
  onOpenImage?: (src: string, alt: string) => void;
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isAnimated(mime: string): boolean {
  return mime === 'image/gif' || mime === 'image/webp';
}

export function ChatMessageItem({ item: m, isOwn, onOpenImage }: ChatMessageItemProps): JSX.Element {
  const { t } = useTranslation('chat');
  const memberToken = useConnectionStore((s) => s.localParticipant?.memberToken ?? '');

  function attachmentSrc(a: Attachment): string {
    return a.url.startsWith('blob:') ? a.url : attachmentDownloadUrl(a, memberToken);
  }

  return (
    <li className={isOwn ? 'self-end text-right' : 'self-start text-left'}>
      <div className="text-xs text-slate-400">
        <span className="font-medium">{m.senderName}</span> · {formatTime(m.sentAt)}
      </div>
      {m.text !== '' && (
        <div
          data-testid="chat-text"
          className="inline-block max-w-xs whitespace-pre-wrap break-words rounded-lg bg-surface-muted px-3 py-2 text-sm text-slate-100"
        >
          {m.text}
        </div>
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
      {isOwn && m.status === 'sending' && (
        <div className="text-xs text-slate-500">{t('sending')}</div>
      )}
      {isOwn && m.status === 'failed' && (
        <div className="text-xs text-red-400">{t('notDelivered')}</div>
      )}
    </li>
  );
}
