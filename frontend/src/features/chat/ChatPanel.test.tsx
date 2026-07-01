import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../shared/i18n';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from '../../stores/useChatStore';
import { useConnectionStore } from '../../stores/useConnectionStore';

// The panel manages a socket via useChat; stub it so the test needs no server.
vi.mock('./hooks/useChat', () => ({ useChat: () => ({ sendMessage: vi.fn() }) }));

describe('ChatPanel', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_self', displayName: 'Me', roomId: 'r_test' });
  });

  it('renders the empty state when open with no messages', () => {
    useChatStore.getState().openPanel();
    render(<ChatPanel role="guest" />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message…')).toBeInTheDocument();
  });

  it('renders messages from the store', () => {
    useChatStore.getState().openPanel();
    useChatStore.getState().setHistory([
      { id: 'a', roomName: 'main', senderIdentity: 'p_x', senderName: 'X', sentAt: 1, text: 'history msg', attachments: [] },
    ]);
    render(<ChatPanel role="guest" />);
    expect(screen.getByText('history msg')).toBeInTheDocument();
  });
});
