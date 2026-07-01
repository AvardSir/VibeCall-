import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { MessageList } from './MessageList';
import type { ChatItem } from '../../../stores/useChatStore';

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

describe('MessageList', () => {
  it('renders the empty state when there are no messages', () => {
    render(<MessageList items={[]} selfIdentity="p_self" />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('renders messages in order with their text bodies', () => {
    render(
      <MessageList
        items={[item({ key: '1', text: 'first' }), item({ key: '2', text: 'second', senderName: 'Bo' })]}
        selfIdentity="p_self"
      />,
    );
    const texts = screen.getAllByTestId('chat-text-body').map((el) => el.textContent);
    expect(texts).toEqual(['first', 'second']);
  });

  it('marks the first message of a sender run as first-in-group (shows its sender name)', () => {
    render(
      <MessageList
        items={[
          item({ key: '1', senderIdentity: 'a', senderName: 'Ann', text: 'a1' }),
          item({ key: '2', senderIdentity: 'a', senderName: 'Ann', text: 'a2' }),
          item({ key: '3', senderIdentity: 'b', senderName: 'Bo', text: 'b1' }),
        ]}
        selfIdentity="p_self"
      />,
    );
    // Ann's name shows once (first bubble of her run); Bo's shows once.
    expect(screen.getAllByText('Ann')).toHaveLength(1);
    expect(screen.getAllByText('Bo')).toHaveLength(1);
  });

  it('shows the Sending… / Not delivered status on own messages', () => {
    render(
      <MessageList
        items={[
          item({ key: 's', senderIdentity: 'p_self', status: 'sending' }),
          item({ key: 'f', senderIdentity: 'p_self', status: 'failed' }),
        ]}
        selfIdentity="p_self"
      />,
    );
    expect(screen.getByText('Sending…')).toBeInTheDocument();
    expect(screen.getByText('Not delivered')).toBeInTheDocument();
  });
});
