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
    ...over,
  };
}

describe('MessageList', () => {
  it('renders the empty state when there are no messages', () => {
    render(<MessageList items={[]} selfIdentity="p_self" />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('renders messages in order with sender names', () => {
    render(
      <MessageList
        items={[item({ key: '1', text: 'first' }), item({ key: '2', text: 'second', senderName: 'Bo' })]}
        selfIdentity="p_self"
      />,
    );
    const texts = screen.getAllByTestId('chat-text').map((el) => el.textContent);
    expect(texts).toEqual(['first', 'second']);
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
