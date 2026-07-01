import type { JSX, MouseEvent } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type ImageLightboxProps = { src: string; alt: string; onClose: () => void };

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps): JSX.Element {
  const { t } = useTranslation('chat');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
      // Opaque backdrop: the webcam <video> tiles are hardware-composited, and a translucent overlay
      // over them flickered during browser (Ctrl +/-) zoom re-rasterization. A fully opaque backdrop
      // leaves no video showing through, so there is nothing to flicker.
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
    >
      <button
        ref={closeButtonRef}
        type="button"
        aria-label={t('closeLightbox')}
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg px-2 py-2 text-2xl leading-none text-slate-200 hover:bg-white/10 hover:text-white"
      >
        ×
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />
    </div>
  );
}
