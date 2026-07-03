import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { ImageLightbox } from './ImageLightbox';

describe('ImageLightbox', () => {
  it('shows the image and closes on Esc, backdrop, and the close button', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="/attachments/r1/f0/c.png?token=m1" alt="c.png" onClose={onClose} />);

    expect(screen.getByRole('img', { name: 'c.png' })).toHaveAttribute(
      'src',
      expect.stringContaining('?token=m1'),
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when the image itself is clicked', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="x" alt="c" onClose={onClose} />);

    fireEvent.click(screen.getByRole('img'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ImageLightbox src="x" alt="c" onClose={onClose} />);

    const backdrop = container.querySelector('[role="dialog"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has dialog semantics and moves focus to the close button on mount', () => {
    render(<ImageLightbox src="x" alt="c" onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toHaveFocus();
  });

  it('dims with a semi-transparent backdrop (not fully opaque) so the call stays visible behind', () => {
    const { container } = render(<ImageLightbox src="x" alt="c" onClose={vi.fn()} />);

    // The dim is a dedicated aria-hidden layer; it must use a translucent black, never opaque bg-black.
    const dim = container.querySelector('[aria-hidden="true"]');
    expect(dim).not.toBeNull();
    expect((dim as Element).className).toContain('bg-black/70');
    // Guard against a regression back to the opaque `bg-black` (with no /opacity suffix).
    expect((dim as Element).className).not.toMatch(/\bbg-black(?!\/)/);
  });

  it('removes the keydown listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<ImageLightbox src="x" alt="c" onClose={onClose} />);
    unmount();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the previously-focused element on unmount', () => {
    render(<button type="button">trigger</button>);
    const trigger = screen.getByRole('button', { name: 'trigger' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { unmount } = render(<ImageLightbox src="x" alt="c" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
  });
});
