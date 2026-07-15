import type { JSX, ReactNode } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  // Stretch to the container width (e.g. to match a form field's width); default is content width.
  fullWidth?: boolean;
};

// Figma CTA button: 10px radius, 28/12 padding → 48px tall with 16px/lh24 label at weight 452.
const BASE =
  'inline-flex items-center justify-center rounded-[10px] px-7 py-3 text-base font-[452] transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-white dark:text-surface dark:hover:bg-white/75',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button', fullWidth = false }: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(BASE, VARIANT_CLASSES[variant], fullWidth && 'w-full')}
    >
      {children}
    </button>
  );
}
