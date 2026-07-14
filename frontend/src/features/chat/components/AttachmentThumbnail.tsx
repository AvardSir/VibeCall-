import type { JSX, KeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';

export type AttachmentThumbnailProps = {
  src: string;
  name: string;
  animated: boolean;
  onOpen: () => void;
};

const MAX_BOX_PX = 160;

export function AttachmentThumbnail({ src, name, animated, onOpen }: AttachmentThumbnailProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!animated) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(MAX_BOX_PX / img.width, MAX_BOX_PX / img.height, 1);
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Drawing the freshly-loaded Image draws its first frame — this freezes an animated
      // GIF/WebP to a still for the list view (the lightbox, Task 18/19, shows the live source).
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = src;
  }, [animated, src]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  if (!animated) {
    return (
      <img
        src={src}
        alt={name}
        onClick={onOpen}
        className="max-h-40 max-w-40 cursor-pointer rounded-lg object-cover"
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={name}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="inline-block cursor-pointer rounded-lg"
    >
      <canvas ref={canvasRef} className="max-h-40 max-w-40 rounded-lg object-cover" />
    </div>
  );
}
