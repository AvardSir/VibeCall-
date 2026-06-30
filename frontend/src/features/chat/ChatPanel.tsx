import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/useChatStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import type { ParticipantRole } from '../../shared/types';
import { useChat } from './hooks/useChat';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

export type ChatPanelProps = { role: ParticipantRole };

export function ChatPanel({ role }: ChatPanelProps): JSX.Element {
  const { t } = useTranslation('chat');
  const { sendMessage } = useChat(role);
  const messages = useChatStore((s) => s.messages);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const selfIdentity = useConnectionStore((s) => s.localParticipant?.identity ?? '');

  return (
    <aside
      aria-label={t('title')}
      className={`fixed right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-surface-muted bg-surface transition-transform ${
        isPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <header className="border-b border-surface-muted p-3 text-sm font-medium text-slate-200">
        {t('title')}
      </header>
      <MessageList items={messages} selfIdentity={selfIdentity} />
      <ChatInput onSend={sendMessage} />
    </aside>
  );
}
