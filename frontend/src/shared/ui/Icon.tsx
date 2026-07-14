import type { JSX } from 'react';
import clsx from 'clsx';
import { ICONS, type IconName } from '../assets/icons';

export type IconProps = { name: IconName; className?: string };

// First-party bundled SVG markup (shared/assets/icons) — trusted, not user content.
// Inlined so the glyph inherits currentColor and is sized via className.
export function Icon({ name, className }: IconProps): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={clsx('inline-flex [&>svg]:h-full [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
