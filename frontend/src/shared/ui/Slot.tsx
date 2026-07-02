import { cloneElement, isValidElement } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';
import clsx from 'clsx';

export type SlotProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
};

type MergeableProps = HTMLAttributes<HTMLElement> & { className?: string; ref?: Ref<HTMLElement> };
type MergeableChild = ReactElement<MergeableProps>;

// Radix-style `asChild` helper: instead of rendering its own wrapper element, Slot merges the
// given props onto its single child element. The child's own props win on conflict, EXCEPT
// `className` (merged, so the slot's styling is not lost — the reviewer's example dropped the
// slot className) and `ref` (the slot's ref wins, so a parent can forward a ref to the real node).
export function Slot({ children, className, ref, ...props }: SlotProps): ReactNode {
  if (!isValidElement(children)) {
    return null;
  }
  const child = children as MergeableChild;
  return cloneElement(child, {
    ...props,
    ...child.props,
    className: clsx(className, child.props.className),
    ref,
  });
}
