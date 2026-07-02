import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../shared/i18n';
import { PreJoinScreen } from './PreJoinScreen';
import { useMediaStore } from '../../stores/useMediaStore';

function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

beforeEach(() => {
  useMediaStore.getState().reset();
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) },
  });
});

describe('PreJoinScreen', () => {
  it('keeps Join clickable and surfaces the length error on an invalid submit (PRD: error on click)', async () => {
    const onEnter = vi.fn();
    render(<PreJoinScreen onEnter={onEnter} />);
    const button = screen.getByRole('button', { name: /^join$/i });
    // Enabled so the click/Enter can surface the error rather than silently doing nothing.
    expect(button).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'A' } });
    fireEvent.click(button);
    expect(await screen.findByText(/must be 2.30 characters/i)).toBeInTheDocument();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('surfaces the empty-name error when submitting a blank name', async () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    expect(await screen.findByText('Please enter your name')).toBeInTheDocument();
  });

  it('surfaces the allowed-characters error for disallowed characters', async () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '@@' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    expect(await screen.findByText(/only letters, numbers, spaces/i)).toBeInTheDocument();
  });

  it('shows the requirement hint before any error is triggered', () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    expect(screen.getByText(/Letters, numbers, spaces, hyphens and apostrophes/i)).toBeInTheDocument();
  });

  it('calls onEnter with the trimmed name', async () => {
    const onEnter = vi.fn();
    render(<PreJoinScreen onEnter={onEnter} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Ann  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('Ann'));
  });

  it('submits on Enter in the name field once the name is valid', async () => {
    const onEnter = vi.fn();
    render(<PreJoinScreen onEnter={onEnter} />);
    const input = screen.getByLabelText(/your name/i);
    fireEvent.change(input, { target: { value: '  Ann  ' } });
    fireEvent.submit(input);
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('Ann'));
  });

  it('renders the wider PRD/wireframe card with the title and CTA', () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    // the H1 title
    expect(screen.getByRole('heading', { name: 'Enter your name' })).toBeInTheDocument();
    // the card container carries the wireframe geometry (wider card, larger preview area)
    const card = document.querySelector('.w-\\[560px\\]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('rounded-[12px]', 'bg-slate-100', 'dark:bg-surface-elevated', 'p-8');
  });

  it('labels the CTA per role (guest → Join, host → Enter call)', () => {
    const { rerender } = render(<PreJoinScreen onEnter={vi.fn()} role="guest" />);
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    rerender(<PreJoinScreen onEnter={vi.fn()} role="host" />);
    expect(screen.getByRole('button', { name: /Enter call/ })).toBeInTheDocument();
  });
});
