import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatItem } from '../../../stores/useChatStore';
import { Icon } from '../../../shared/ui/Icon';
import { ChatMessageItem } from './ChatMessageItem';

export type MessageListProps = {
  items: ChatItem[];
  selfIdentity: string;
  onOpenImage?: (src: string, alt: string) => void;
};

export function MessageList({ items, selfIdentity, onOpenImage }: MessageListProps): JSX.Element {
  const { t } = useTranslation('chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stick to the bottom on send/receive so the newest message is always visible (FR-23). Keyed on
  // the message count so it runs whenever a message is added.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  if (items.length === 0) {
    // Figma Frame 1321314319: an image/placeholder glyph above the "no messages" copy.
    return (
      <div className="grid flex-1 place-content-center justify-items-center gap-3 text-slate-400 dark:text-slate-500">
        <Icon name="noMessages" className="h-[54px] w-20" />
        <span className="text-sm">{t('empty')}</span>
      </div>
    );
  }

  // The scroll container owns overflow; the inner list uses `mt-auto` so a short history rests at the
  // bottom (next to the input) and a long one opens on the newest message — no forced scrolling.
  return (
    <div
      ref={scrollRef}
      data-testid="message-scroll"
      className="scrollbar-hide flex flex-1 flex-col overflow-y-auto"
    >
      <ul className="mt-auto flex flex-col gap-2 px-6 py-3">
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
    </div>
  );
}
