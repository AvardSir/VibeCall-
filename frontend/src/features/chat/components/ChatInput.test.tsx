import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../shared/i18n';
import { ChatInput } from './ChatInput';
import { useChatStore } from '../../../stores/useChatStore';

describe('ChatInput', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

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
    expect(onSend).toHaveBeenCalledWith('hello', []);
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

  it('stages a valid image and shows it as a chip', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const input = screen.getByTestId('attach-input');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await userEvent.upload(input, file);
    expect(screen.getByText('a.png')).toBeInTheDocument();
  });

  it('rejects an unsupported file type and shows the inline error', () => {
    render(<ChatInput onSend={vi.fn()} />);
    const input = screen.getByTestId('attach-input');
    const file = new File(['x'], 'malware.exe', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('Unsupported file type.')).toBeInTheDocument();
    expect(screen.queryByText('malware.exe')).not.toBeInTheDocument();
  });

  it('enables Send with empty text when a file is staged', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const input = screen.getByTestId('attach-input');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await userEvent.upload(input, file);
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('shows the tooManyFiles error when a 6th file is attempted', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const input = screen.getByTestId('attach-input');
    for (let i = 0; i < 5; i++) {
      await userEvent.upload(input, new File(['x'], `f${i}.png`, { type: 'image/png' }));
    }
    await userEvent.upload(input, new File(['x'], 'f5.png', { type: 'image/png' }));
    expect(screen.getByText('You can attach up to 5 files per message.')).toBeInTheDocument();
  });

  it('removes a staged file when its remove button is clicked', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const input = screen.getByTestId('attach-input');
    await userEvent.upload(input, new File(['x'], 'a.png', { type: 'image/png' }));
    expect(screen.getByText('a.png')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('a.png')).not.toBeInTheDocument();
  });
});
