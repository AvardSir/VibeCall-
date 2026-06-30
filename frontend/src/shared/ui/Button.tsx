import type { ReactNode } from 'react';
import type { JSX } from 'react';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
  title?: string;
};

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button', title }: ButtonProps): JSX.Element {
  const base = 'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent/90',
    ghost: 'bg-transparent text-slate-200 hover:bg-surface-muted',
  } as const;
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}
