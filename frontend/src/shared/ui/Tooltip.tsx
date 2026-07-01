import type { JSX, ReactNode } from 'react';

export type TooltipProps = {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'bottom';
};

// Dep-free custom tooltip: wraps a single trigger and reveals a styled bubble on hover and on
// keyboard focus (group-focus-within). Native `title` can't be styled to the design, hence this.
export function Tooltip({ label, children, placement = 'top' }: TooltipProps): JSX.Element {
  // Figma white bubble sits 44px above the trigger (mb-2.5 = 10px + the control gap).
  const position = placement === 'top' ? 'bottom-full mb-2.5' : 'top-full mt-2.5';
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 ${position} whitespace-nowrap rounded-[8px] bg-white px-3 py-1.5 text-sm font-semibold leading-[18px] text-surface opacity-0 shadow transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
