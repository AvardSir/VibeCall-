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
  it('disables Join until the name is valid', async () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    const button = screen.getByRole('button', { name: /^join$/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('calls onEnter with the trimmed name', async () => {
    const onEnter = vi.fn();
    render(<PreJoinScreen onEnter={onEnter} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Ann  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('Ann'));
  });

  it('renders a fixed-width Figma card with the title and CTA', () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    // the H1 title
    expect(screen.getByRole('heading', { name: 'Enter your name' })).toBeInTheDocument();
    // the card container carries the Figma geometry
    const card = document.querySelector('.w-\\[412px\\]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('rounded-[12px]', 'bg-slate-100', 'dark:bg-surface-elevated', 'p-10');
  });

  it('labels the CTA per role (guest → Join, host → Enter call)', () => {
    const { rerender } = render(<PreJoinScreen onEnter={vi.fn()} role="guest" />);
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    rerender(<PreJoinScreen onEnter={vi.fn()} role="host" />);
    expect(screen.getByRole('button', { name: /Enter call/ })).toBeInTheDocument();
  });
});
