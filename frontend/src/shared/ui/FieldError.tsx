import type { JSX, ReactNode } from 'react';
import clsx from 'clsx';

export type FieldErrorProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  // The Figma "error" element (node 31:5088/31:5089) prefixes field-validation messages with a red
  // asterisk; standalone status errors (e.g. a failed network action) pass asterisk={false}.
  asterisk?: boolean;
};

// Shared error text matching the Figma "error" element: red #ff4e4e (text-danger), 14px (text-sm),
// weight 300 (font-light), 18px line-height, optional "*" prefix with a 4px gap, top-aligned.
export function FieldError({ children, id, className, asterisk = true }: FieldErrorProps): JSX.Element {
  return (
    <span
      id={id}
      role="alert"
      className={clsx('flex items-start gap-1 text-sm font-light leading-[18px] text-danger', className)}
    >
      {asterisk ? <span aria-hidden="true">*</span> : null}
      <span>{children}</span>
    </span>
  );
}
