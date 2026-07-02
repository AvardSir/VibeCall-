import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatItem } from '../../../stores/useChatStore';

export type ChatMessageItemProps = { item: ChatItem; isOwn: boolean };

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessageItem({ item: m, isOwn }: ChatMessageItemProps): JSX.Element {
  const { t } = useTranslation('chat');

  return (
    <li className={isOwn ? 'self-end text-right' : 'self-start text-left'}>
      <div className="text-xs text-slate-400">
        <span className="font-medium">{m.senderName}</span> · {formatTime(m.sentAt)}
      </div>
      <div
        data-testid="chat-text"
        className="inline-block max-w-xs whitespace-pre-wrap break-words rounded-lg bg-surface-muted px-3 py-2 text-sm text-slate-100"
      >
        {m.text}
      </div>
      {isOwn && m.status === 'sending' && (
        <div className="text-xs text-slate-500">{t('sending')}</div>
      )}
      {isOwn && m.status === 'failed' && (
        <div className="text-xs text-red-400">{t('notDelivered')}</div>
      )}
    </li>
  );
}
