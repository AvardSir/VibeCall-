import type { ReactNode } from 'react';
import type { JSX } from 'react';

export type TextProps = {
  children: ReactNode;
  variant?: 'title' | 'body';
  as?: 'h1' | 'h2' | 'p' | 'span';
  className?: string;
};

const VARIANTS = {
  title: 'text-2xl font-semibold',
  body: 'text-slate-400',
} as const;

const DEFAULT_TAG = { title: 'h1', body: 'p' } as const;

export function Text({ children, variant = 'body', as, className }: TextProps): JSX.Element {
  const Tag = as ?? DEFAULT_TAG[variant];
  const classes = className ? `${VARIANTS[variant]} ${className}` : VARIANTS[variant];
  return <Tag className={classes}>{children}</Tag>;
}
