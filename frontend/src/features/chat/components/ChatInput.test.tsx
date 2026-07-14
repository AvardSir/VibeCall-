import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../shared/i18n';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('disables Send when the field is empty or whitespace', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Type a message…'), '   ');
    expect(send).toBeDisabled();
  });

  it('sends the trimmed-non-empty text and clears the field', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const field = screen.getByPlaceholderText('Type a message…');
    await userEvent.type(field, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('hello');
    expect(field).toHaveValue('');
  });

  it('shows the character counter only from 900 characters', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const field = screen.getByPlaceholderText('Type a message…');
    await userEvent.click(field);
    await userEvent.paste('a'.repeat(899));
    expect(screen.queryByText(/\/1000$/)).not.toBeInTheDocument();
    await userEvent.paste('a'); // now 900
    expect(screen.getByText('900/1000')).toBeInTheDocument();
  });
});
