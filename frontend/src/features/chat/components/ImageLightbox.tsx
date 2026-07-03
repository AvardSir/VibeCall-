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
      // `isolate` gives the overlay its own stacking/compositing context so its children can be
      // promoted to independent GPU layers below.
      className="fixed inset-0 z-[60] flex items-center justify-center isolate"
    >
      {/* Semi-transparent dim so the call stays visible behind the lightbox (PRD US-10/FR-27).
          The dim is a separate, static, GPU-promoted layer (transform-gpu + will-change) sitting on
          its own compositor layer — it never re-rasterizes with the hardware-composited webcam
          <video> tiles underneath, which is what flickered during browser (Ctrl +/-) zoom when the
          translucent color lived on the same layer as the video. `pointer-events-none` lets
          backdrop clicks fall through to the dialog container for close-on-outside-click. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 transform-gpu will-change-transform pointer-events-none"
      />
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
        // Own GPU layer so the image composites independently of the dim and the video below.
        className="relative max-h-[90vh] max-w-[90vw] object-contain transform-gpu"
      />
    </div>
  );
}
