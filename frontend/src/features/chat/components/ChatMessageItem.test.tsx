import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { ChatMessageItem } from './ChatMessageItem';
import type { ChatItem } from '../../../stores/useChatStore';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';

function item(over: Partial<ChatItem>): ChatItem {
  return {
    key: 'k',
    senderIdentity: 'p_other',
    senderName: 'Other',
    sentAt: 0,
    text: 'hello',
    status: 'delivered',
    attachments: [],
    ...over,
  };
}

beforeEach(() => {
  useConnectionStore.getState().setLocalParticipant({
    identity: 'p_self',
    displayName: 'Self',
    roomId: 'r1',
    memberToken: 'm1',
  });
});

describe('ChatMessageItem Figma styling', () => {
  it('colors the sender name blue for own and purple for others (first in group)', () => {
    const { rerender } = render(<ChatMessageItem item={item({ senderName: 'Ann' })} isOwn isFirstInGroup />);
    expect(screen.getByText('Ann')).toHaveClass('text-accent');
    rerender(<ChatMessageItem item={item({ senderName: 'Ann' })} isOwn={false} isFirstInGroup />);
    expect(screen.getByText('Ann')).toHaveClass('text-sender');
  });

  it('hides the sender name for subsequent (non-first) bubbles in a group', () => {
    render(<ChatMessageItem item={item({ senderName: 'Ann' })} isOwn={false} isFirstInGroup={false} />);
    expect(screen.queryByText('Ann')).toBeNull();
  });

  it('uses the Figma bubble background + full radius for the first bubble in a group', () => {
    render(<ChatMessageItem item={item({})} isOwn={false} isFirstInGroup />);
    expect(screen.getByTestId('chat-text')).toHaveClass('bg-white', 'rounded-[12px]');
  });

  it('cuts the inner bottom corner for subsequent bubbles (others → bottom-left)', () => {
    render(<ChatMessageItem item={item({})} isOwn={false} isFirstInGroup={false} />);
    expect(screen.getByTestId('chat-text')).toHaveClass('rounded-bl-[4px]');
  });

  it('cuts the inner bottom corner for subsequent own bubbles (own → bottom-right)', () => {
    render(<ChatMessageItem item={item({})} isOwn isFirstInGroup={false} />);
    expect(screen.getByTestId('chat-text')).toHaveClass('rounded-br-[4px]');
  });

  it('places the sender name inside the first bubble, combined with the text (Figma)', () => {
    render(<ChatMessageItem item={item({ senderName: 'Ann', text: 'hi there' })} isOwn={false} isFirstInGroup />);
    const bubble = screen.getByTestId('chat-text');
    // name + body live in the SAME bubble, not as a separate label above it
    expect(bubble).toHaveTextContent('Ann');
    expect(bubble).toHaveTextContent('hi there');
    expect(screen.getByText('Ann')).toHaveClass('text-sender');
  });

  it('renders the message text and an inline timestamp in the bubble', () => {
    render(<ChatMessageItem item={item({ text: 'hi there' })} isOwn={false} isFirstInGroup />);
    const bubble = screen.getByTestId('chat-text');
    expect(bubble).toHaveTextContent('hi there');
    expect(screen.getByTestId('chat-text-body')).toHaveClass('text-slate-900');
    expect(screen.getByTestId('chat-timestamp')).toHaveClass('text-slate-500');
  });

  it('formats the timestamp as 24-hour HH:MM (no AM/PM)', () => {
    // Constructed in local time and formatted in local time → tz-independent expectation.
    const sentAt = new Date(2020, 0, 1, 20, 30, 0).getTime();
    render(<ChatMessageItem item={item({ text: 'hi', sentAt })} isOwn={false} isFirstInGroup />);
    const ts = screen.getByTestId('chat-timestamp').textContent ?? '';
    expect(ts).toContain('20:30');
    expect(ts).not.toMatch(/[AP]M/i);
  });
});

describe('ChatMessageItem failed-message retry', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('shows a Try again affordance next to Not delivered on a failed own message', () => {
    render(<ChatMessageItem item={item({ senderIdentity: 'p_self', status: 'failed' })} isOwn isFirstInGroup />);
    expect(screen.getByText('Not delivered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('restores the failed text + staged files to the composer and removes the failed bubble', () => {
    const staged = { id: 's0', file: new File(['x'], 'a.png', { type: 'image/png' }) };
    const failed: ChatItem = {
      ...item({ key: 'c1', senderIdentity: 'p_self', status: 'failed', text: 'retry me' }),
      stagedFiles: [staged],
    };
    useChatStore.setState({ messages: [failed] });
    render(<ChatMessageItem item={failed} isOwn isFirstInGroup />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    const s = useChatStore.getState();
    expect(s.composerDraft).toBe('retry me');
    expect(s.stagedAttachments).toEqual([staged]);
    expect(s.messages).toEqual([]);
  });
});

describe('ChatMessageItem attachments', () => {
  it('renders an image attachment as a thumbnail with a tokened src and calls onOpenImage on click', () => {
    const onOpenImage = vi.fn();
    render(
      <ChatMessageItem
        item={item({
          text: '',
          attachments: [
            { fileId: 'f1', name: 'photo.png', size: 100, mime: 'image/png', kind: 'image', url: '/attachments/f1' },
          ],
        })}
        isOwn={false}
        isFirstInGroup
        onOpenImage={onOpenImage}
      />,
    );

    const img = screen.getByAltText('photo.png');
    expect(img.getAttribute('src')).toContain('?token=');
    fireEvent.click(img);
    expect(onOpenImage).toHaveBeenCalledTimes(1);
    expect(onOpenImage).toHaveBeenCalledWith(expect.stringContaining('?token='), 'photo.png');
  });

  it('aligns own-message attachments to the right (matching the right-aligned text)', () => {
    const attachments = [
      { fileId: 'f1', name: 'a.png', size: 100, mime: 'image/png', kind: 'image' as const, url: '/attachments/f1' },
      { fileId: 'f2', name: 'b.png', size: 100, mime: 'image/png', kind: 'image' as const, url: '/attachments/f2' },
    ];
    const { rerender } = render(
      <ChatMessageItem item={item({ text: '', senderIdentity: 'p_self', attachments })} isOwn isFirstInGroup />,
    );
    expect(screen.getByTestId('attachments')).toHaveClass('justify-end');
    rerender(<ChatMessageItem item={item({ text: '', attachments })} isOwn={false} isFirstInGroup />);
    expect(screen.getByTestId('attachments')).not.toHaveClass('justify-end');
  });

  it('renders a file attachment as a download link containing the token and file name', () => {
    render(
      <ChatMessageItem
        item={item({
          text: '',
          attachments: [
            { fileId: 'f2', name: 'doc.pdf', size: 2048, mime: 'application/pdf', kind: 'file', url: '/attachments/f2' },
          ],
        })}
        isOwn={false}
        isFirstInGroup
      />,
    );

    const link = screen.getByRole('link', { name: /doc\.pdf/i });
    expect(link.getAttribute('href')).toContain('?token=');
    expect(link).toHaveAttribute('download', 'doc.pdf');
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
  });
});
