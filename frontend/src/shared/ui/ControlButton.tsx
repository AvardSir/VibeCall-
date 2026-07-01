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
};

const VARIANT_CLASSES: Record<ControlVariant, string> = {
  white: 'bg-white text-surface hover:bg-white/75',
  dark: 'bg-surface-elevated text-white hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger-strong',
  active: 'bg-accent text-white hover:bg-accent-strong',
};

export function ControlButton({
  icon,
  label,
  onClick,
  variant = 'white',
  disabled,
}: ControlButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex size-12 items-center justify-center rounded-[30px] transition disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
      )}
    >
      <Icon name={icon} className="h-[30px] w-[30px]" />
    </button>
  );
}
