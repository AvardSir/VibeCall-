import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { ChatMessageItem } from './ChatMessageItem';
import type { ChatItem } from '../../../stores/useChatStore';
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
    expect(screen.getByTestId('chat-text')).toHaveClass('bg-surface', 'rounded-[12px]');
  });

  it('cuts the inner bottom corner for subsequent bubbles (others → bottom-left)', () => {
    render(<ChatMessageItem item={item({})} isOwn={false} isFirstInGroup={false} />);
    expect(screen.getByTestId('chat-text')).toHaveClass('rounded-bl-[4px]');
  });

  it('cuts the inner bottom corner for subsequent own bubbles (own → bottom-right)', () => {
    render(<ChatMessageItem item={item({})} isOwn isFirstInGroup={false} />);
    expect(screen.getByTestId('chat-text')).toHaveClass('rounded-br-[4px]');
  });

  it('renders the message text and an inline timestamp in the bubble', () => {
    render(<ChatMessageItem item={item({ text: 'hi there' })} isOwn={false} isFirstInGroup />);
    const bubble = screen.getByTestId('chat-text');
    expect(bubble).toHaveTextContent('hi there');
    expect(screen.getByTestId('chat-text-body')).toHaveClass('text-white');
    expect(screen.getByTestId('chat-timestamp')).toHaveClass('text-white/50');
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
