import type { JSX, ReactNode } from 'react';

export type TooltipProps = {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'bottom';
};

// Dep-free custom tooltip: wraps a single trigger and reveals a styled bubble on hover and on
// keyboard focus (group-focus-within). Native `title` can't be styled to the design, hence this.
export function Tooltip({ label, children, placement = 'top' }: TooltipProps): JSX.Element {
  const position = placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 ${position} whitespace-nowrap rounded bg-surface-elevated px-2 py-1 text-xs text-slate-100 opacity-0 shadow transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
