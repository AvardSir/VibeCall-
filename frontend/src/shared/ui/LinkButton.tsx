import type { ReactNode, Ref } from 'react';
import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export type LinkButtonProps = {
  to: string;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLAnchorElement>;
};

// The verbatim link styling shared by the room-state screens — extracted as-is to remove the 5x
// duplication with zero visual change (identical classes to the previous inline <Link>).
const LINK_BUTTON_CLASSES =
  'rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted';

export function LinkButton({ to, children, className, ref }: LinkButtonProps): JSX.Element {
  return (
    <Link to={to} ref={ref} className={clsx(LINK_BUTTON_CLASSES, className)}>
      {children}
    </Link>
  );
}
