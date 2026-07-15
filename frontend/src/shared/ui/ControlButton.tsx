import type { JSX } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';
import type { IconName } from '../assets/icons';

export type ControlVariant = 'white' | 'dark' | 'danger' | 'active';

export type ControlButtonProps = {
  icon: IconName;
  label: string;
  onClick: () => void;
  variant?: ControlVariant;
  disabled?: boolean;
  // Override the inner icon size. Most glyphs sit at 30px; a few (screen-share, link) have less
  // built-in padding and read as oversized at that size, so those callers pass a slightly smaller box.
  iconClassName?: string;
};

const VARIANT_CLASSES: Record<ControlVariant, string> = {
  white:
    'bg-slate-800 text-white hover:bg-slate-700 dark:bg-white dark:text-surface dark:hover:bg-white/75',
  dark: 'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-surface-elevated dark:text-white dark:hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger-strong',
  active: 'bg-accent text-white hover:bg-accent-strong',
};

export function ControlButton({
  icon,
  label,
  onClick,
  variant = 'white',
  disabled,
  iconClassName = 'h-[30px] w-[30px]',
}: ControlButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex size-12 items-center justify-center rounded-[30px] transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        VARIANT_CLASSES[variant],
      )}
    >
      <Icon name={icon} className={iconClassName} />
    </button>
  );
}
