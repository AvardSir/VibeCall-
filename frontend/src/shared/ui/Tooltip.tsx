import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

export type TooltipProps = {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'bottom';
};

const OPEN_DELAY_MS = 400;
// Broadcast so only one tooltip shows at a time: when one opens it announces its id on the document,
// and every other tooltip closes itself. Uses a DOM event (no shared mutable module state).
const OPEN_EVENT = 'kmb:tooltip-open';

// Dep-free custom tooltip (native `title` can't be styled to the design). Shows after a short hover
// delay and on keyboard focus; hidden on leave/blur and on click. JS-controlled (not CSS group-hover)
// so it can enforce the delay and the single-open-at-a-time rule.
export function Tooltip({ label, children, placement = 'top' }: TooltipProps): JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A pointer press focuses the trigger; suppress the focus-open so clicking dismisses (not re-shows).
  const pointerDownRef = useRef(false);

  const hide = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  }, []);

  const show = useCallback((): void => {
    document.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: id }));
    setOpen(true);
  }, [id]);

  // Close when another tooltip opens (single-open rule), and clean up the timer on unmount.
  useEffect(() => {
    const onOtherOpen = (e: Event): void => {
      if ((e as CustomEvent<string>).detail !== id) hide();
    };
    document.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => {
      document.removeEventListener(OPEN_EVENT, onOtherOpen);
      hide();
    };
  }, [id, hide]);

  const scheduleShow = (): void => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(show, OPEN_DELAY_MS);
  };

  const isTop = placement === 'top';
  const position = isTop ? 'bottom-full mb-2.5' : 'top-full mt-2.5';
  // Speech-bubble tail (Figma 56:3010): a 14×6px triangle centered on the body edge, pointing at the
  // trigger. Built from borders on a zero-size box; its color mirrors the body bg in both themes.
  const tail = isTop
    ? 'top-full border-x-[7px] border-t-[6px] border-x-transparent border-t-slate-800 dark:border-t-white'
    : 'bottom-full border-x-[7px] border-b-[6px] border-x-transparent border-b-slate-800 dark:border-b-white';

  return (
    <span
      className="group relative inline-flex"
      onPointerEnter={scheduleShow}
      onPointerLeave={hide}
      onPointerDown={() => {
        pointerDownRef.current = true;
        hide();
      }}
      onFocus={() => {
        if (!pointerDownRef.current) show();
      }}
      onBlur={() => {
        pointerDownRef.current = false;
        hide();
      }}
    >
      {children}
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-slate-800 px-3 py-1.5 text-sm font-semibold leading-[18px] text-white shadow transition-opacity duration-100 dark:bg-white dark:text-surface',
          position,
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        {label}
        <span aria-hidden="true" className={clsx('absolute left-1/2 h-0 w-0 -translate-x-1/2', tail)} />
      </span>
    </span>
  );
}
