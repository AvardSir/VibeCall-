import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { RemoveGuestDialog } from './RemoveGuestDialog';

describe('RemoveGuestDialog', () => {
  it('renders the interpolated title and wires confirm/cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<RemoveGuestDialog name="Ann" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Remove Ann from the call?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('is a modal dialog', () => {
    render(<RemoveGuestDialog name="Ann" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onCancel when the Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(<RemoveGuestDialog name="Ann" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when the backdrop is clicked, but not when the dialog body is clicked', () => {
    const onCancel = vi.fn();
    render(<RemoveGuestDialog name="Ann" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('presentation'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
