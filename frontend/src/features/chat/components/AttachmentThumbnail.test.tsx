import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentThumbnail } from './AttachmentThumbnail';

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
