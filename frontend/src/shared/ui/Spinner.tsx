import type { JSX } from 'react';

export type SpinnerProps = { label?: string };

export function Spinner({ label }: SpinnerProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
      {label ? <span className="text-sm text-slate-300">{label}</span> : null}
    </div>
  );
}
