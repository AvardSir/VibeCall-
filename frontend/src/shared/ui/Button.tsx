import type { ReactNode } from 'react';
import type { JSX } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
};

// Figma CTA button: 10px radius, 28/12 padding → 48px tall with 16px/lh24 label at weight 452.
const BASE =
  'inline-flex items-center justify-center rounded-[10px] px-7 py-3 text-base font-[452] transition disabled:opacity-40 disabled:cursor-not-allowed';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'bg-white text-surface hover:bg-white/75',
  ghost: 'bg-transparent text-slate-200 hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button' }: ButtonProps): JSX.Element {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${BASE} ${VARIANT_CLASSES[variant]}`}>
      {children}
    </button>
  );
}
