import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/useChatStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import type { ParticipantRole } from '../../shared/types';
import { Text } from '../../shared/ui/Text';
import { Icon } from '../../shared/ui/Icon';
import { useChat } from './hooks/useChat';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { ImageLightbox } from './components/ImageLightbox';

export type ChatPanelProps = { role: ParticipantRole };

export function ChatPanel({ role }: ChatPanelProps): JSX.Element {
  const { t } = useTranslation('chat');
  const { sendMessage } = useChat(role);
  const messages = useChatStore((s) => s.messages);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const togglePanel = useChatStore((s) => s.togglePanel);
  const closePanel = useChatStore((s) => s.closePanel);
  const selfIdentity = useConnectionStore((s) => s.localParticipant?.identity ?? '');
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Close the panel on an outside click. Ignore clicks on the chat toggle button (it owns its own
  // toggle) and skip while the image lightbox is open (its backdrop handles its own dismissal).
  useEffect(() => {
    if (!isPanelOpen || lightbox) return;
    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-chat-toggle]')) return;
      closePanel();
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isPanelOpen, lightbox, closePanel]);

  return (
    <>
      <aside
        ref={panelRef}
        aria-labelledby="chat-panel-title"
        className={clsx(
          'fixed right-0 top-0 z-20 flex h-full w-[340px] flex-col bg-slate-100 transition-transform dark:bg-surface-elevated',
          isPanelOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center gap-2.5 border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <button
            type="button"
            aria-label={t('closeChat')}
            onClick={togglePanel}
            className="grid size-6 place-items-center rounded-[17px] bg-slate-800 dark:bg-white"
          >
            {/* Arrow glyph points right by default; rotate 180° so it points left (back). */}
            <Icon name="arrow" className="h-4 w-4 rotate-180 text-white dark:text-surface" />
          </button>
          <Text tag="h2" id="chat-panel-title" size="xl" weight="bold" className="text-slate-900 dark:text-white">
            {t('title')}
          </Text>
        </header>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MessageList
            items={messages}
            selfIdentity={selfIdentity}
            onOpenImage={(src, alt) => setLightbox({ src, alt })}
          />
          {/* Figma: ~65px fade over the last messages, above the input row. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-0 h-16 bg-gradient-to-b from-transparent to-slate-100 dark:to-surface-elevated" />
        </div>
        <ChatInput onSend={sendMessage} />
      </aside>
      {lightbox && (
        <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
