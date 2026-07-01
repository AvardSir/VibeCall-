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
      />,
    );

    const link = screen.getByRole('link', { name: /doc\.pdf/i });
    expect(link.getAttribute('href')).toContain('?token=');
    expect(link).toHaveAttribute('download', 'doc.pdf');
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
  });
});
