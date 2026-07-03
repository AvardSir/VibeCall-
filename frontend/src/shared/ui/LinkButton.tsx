import type { JSX, ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export type LinkButtonProps = {
  to: string;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLAnchorElement>;
};

// Navigation CTA shared by the room-state screens (Removed / Host-ended / Grace-expired / Call-ended /
// Invalid-link). Styled to match the primary <Button> (accent fill) so these single-action CTAs read
// the same as the pre-join "Join" / landing "Start a call" buttons. Kept as an <a> since these navigate
// to a route; mirror Button's BASE + primary classes (no disabled state — a link is never disabled).
const LINK_BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-[10px] bg-accent px-7 py-3 text-base font-[452] text-white transition hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function LinkButton({ to, children, className, ref }: LinkButtonProps): JSX.Element {
  return (
    <Link to={to} ref={ref} className={clsx(LINK_BUTTON_CLASSES, className)}>
      {children}
    </Link>
  );
}
