import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatItem } from '../../../stores/useChatStore';
import { ChatMessageItem } from './ChatMessageItem';

export type MessageListProps = {
  items: ChatItem[];
  selfIdentity: string;
  onOpenImage?: (src: string, alt: string) => void;
};

export function MessageList({ items, selfIdentity, onOpenImage }: MessageListProps): JSX.Element {
  const { t } = useTranslation('chat');
  const listRef = useRef<HTMLUListElement>(null);

  // Stick to the bottom on send/receive so the newest message is always visible (FR-23). Keyed on
  // the message count so it runs whenever a message is added.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-slate-500">{t('empty')}</div>
    );
  }

  return (
    <ul ref={listRef} className="scrollbar-hide flex flex-1 flex-col gap-2 overflow-y-auto px-6 py-3">
      {items.map((m, i) => (
        <ChatMessageItem
          key={m.key}
          item={m}
          isOwn={m.senderIdentity === selfIdentity}
          isFirstInGroup={i === 0 || items[i - 1]!.senderIdentity !== m.senderIdentity}
          onOpenImage={onOpenImage}
        />
      ))}
    </ul>
  );
}
