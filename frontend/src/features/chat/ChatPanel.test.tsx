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

  it('renders the Figma docked panel: 340px width, elevated surface, close control, H2 title', () => {
    useChatStore.getState().openPanel();
    render(<ChatPanel role="guest" />);
    const panel = screen.getByRole('complementary');
    expect(panel).toHaveClass('w-chat-panel', 'bg-slate-100');
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
  });

  it('closes the panel when the close control is clicked', () => {
    useChatStore.getState().openPanel();
    render(<ChatPanel role="guest" />);
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    expect(useChatStore.getState().isPanelOpen).toBe(false);
  });

  it('closes the panel on an outside mousedown', () => {
    useChatStore.getState().openPanel();
    render(<ChatPanel role="guest" />);
    fireEvent.mouseDown(document.body);
    expect(useChatStore.getState().isPanelOpen).toBe(false);
  });

  it('stays open when clicking inside the panel', () => {
    useChatStore.getState().openPanel();
    render(<ChatPanel role="guest" />);
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Chat' }));
    expect(useChatStore.getState().isPanelOpen).toBe(true);
  });

  it('stays open when clicking the chat toggle button (data-chat-toggle)', () => {
    useChatStore.getState().openPanel();
    const { container } = render(
      <>
        <div data-chat-toggle>
          <button type="button">chat</button>
        </div>
        <ChatPanel role="guest" />
      </>,
    );
    const toggle = container.querySelector('[data-chat-toggle] button') as HTMLElement;
    fireEvent.mouseDown(toggle);
    expect(useChatStore.getState().isPanelOpen).toBe(true);
  });

  it('stays open when clicking the top-bar theme/language controls (data-chat-keep-open)', () => {
    useChatStore.getState().openPanel();
    const { container } = render(
      <>
        <div data-chat-keep-open>
          <button type="button">EN</button>
        </div>
        <ChatPanel role="guest" />
      </>,
    );
    const control = container.querySelector('[data-chat-keep-open] button') as HTMLElement;
    fireEvent.mouseDown(control);
    expect(useChatStore.getState().isPanelOpen).toBe(true);
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

    // Exact name: the panel header now also carries a "Close chat" control, so /close/i is ambiguous.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
