import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { ImageLightbox } from './ImageLightbox';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AttachmentThumbnail', () => {
  it('renders a plain clickable image when not animated, and calls onOpen on click', () => {
    const onOpen = vi.fn();
    render(<AttachmentThumbnail src="blob:abc" name="photo.png" animated={false} onOpen={onOpen} />);

    const img = screen.getByAltText('photo.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:abc');

    fireEvent.click(img);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('makes the non-animated thumbnail focusable and keyboard-activatable (FR-27 a11y)', () => {
    const onOpen = vi.fn();
    render(<AttachmentThumbnail src="blob:abc" name="photo.png" animated={false} onOpen={onOpen} />);

    const trigger = screen.getByRole('button', { name: 'photo.png' });
    expect(trigger).toHaveAttribute('tabIndex', '0');

    trigger.focus();
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('restores focus to the originating non-animated thumbnail when the lightbox closes', () => {
    render(<AttachmentThumbnail src="blob:abc" name="photo.png" animated={false} onOpen={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'photo.png' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    // Opening the lightbox captures document.activeElement and restores it on close/unmount.
    const { unmount } = render(<ImageLightbox src="blob:abc" alt="photo.png" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
  });

  it('renders a canvas still (not an img) when animated, and it is keyboard/clickable', () => {
    // jsdom has no real canvas/image decoding — stub getContext so the draw effect doesn't throw,
    // and stub Image so `onload` never needs to fire for this assertion (we only assert the
    // still-frame surface exists and is interactive).
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    const onOpen = vi.fn();
    const { container } = render(
      <AttachmentThumbnail src="https://api/x.gif?token=m1" name="anim.gif" animated onOpen={onOpen} />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: 'anim.gif' });
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(3);
  });
});
