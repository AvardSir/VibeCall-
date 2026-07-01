import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlButton } from './ControlButton';

describe('ControlButton', () => {
  it('renders a 48px round button with an accessible label and the glyph', () => {
    const { container } = render(
      <ControlButton icon="micOn" label="Mute microphone" onClick={() => {}} />,
    );
    const btn = screen.getByRole('button', { name: 'Mute microphone' });
    expect(btn).toHaveClass('size-12', 'rounded-[30px]');
    expect(btn).toHaveClass('bg-white', 'text-surface'); // default variant = white
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('maps variants to Figma classes', () => {
    const { rerender } = render(
      <ControlButton icon="hangup" label="End call" onClick={() => {}} variant="danger" />,
    );
    expect(screen.getByRole('button', { name: 'End call' })).toHaveClass(
      'bg-danger',
      'hover:bg-danger-strong',
    );
    rerender(<ControlButton icon="chat" label="Chat" onClick={() => {}} variant="active" />);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveClass(
      'bg-accent',
      'hover:bg-accent-strong',
    );
    rerender(<ControlButton icon="chat" label="Chat" onClick={() => {}} variant="dark" />);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveClass(
      'bg-surface-elevated',
      'text-white',
    );
  });

  it('fires onClick and respects disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<ControlButton icon="camOn" label="cam" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'cam' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ControlButton icon="camOn" label="cam" onClick={onClick} disabled />);
    await userEvent.click(screen.getByRole('button', { name: 'cam' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
