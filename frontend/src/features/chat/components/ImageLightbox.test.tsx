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

  it('removes the keydown listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<ImageLightbox src="x" alt="c" onClose={onClose} />);
    unmount();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
