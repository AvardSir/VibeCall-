import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../shared/i18n';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from '../../stores/useChatStore';
import { useConnectionStore } from '../../stores/useConnectionStore';

// The panel manages a socket via useChat; stub it so the test needs no server.
vi.mock('./hooks/useChat', () => ({ useChat: () => ({ sendMessage: vi.fn() }) }));

describe('ChatPanel', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_self', displayName: 'Me', roomId: 'r_test', memberToken: 'mt' });
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

  it('opens the lightbox on thumbnail click and closes it via the close button', () => {
    useChatStore.getState().openPanel();
    useChatStore.getState().setHistory([
      {
        id: 'a',
        roomName: 'main',
        senderIdentity: 'p_x',
        senderName: 'X',
        sentAt: 1,
        text: '',
        attachments: [
          { fileId: 'f0', name: 'c.png', size: 100, mime: 'image/png', kind: 'image', url: '/attachments/r_test/f0/c.png' },
        ],
      },
    ]);
    render(<ChatPanel role="guest" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('img', { name: 'c.png' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
