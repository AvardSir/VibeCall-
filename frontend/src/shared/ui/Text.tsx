import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react';
import type { JSX } from 'react';
import clsx from 'clsx';
import { Slot } from './Slot';

export type AllowedTag = 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type TextSize = '2xl' | 'xl' | 'lg' | 'md' | 'sm' | 'xs';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  tag?: AllowedTag;
  size?: TextSize;
  weight?: TextWeight;
  uppercase?: boolean;
  capitalize?: boolean;
  center?: boolean;
  // Render the single child element instead of a wrapper (via Slot), forwarding these styles onto it.
  asChild?: boolean;
  ref?: Ref<HTMLElement>;
};

// Sizes map to the Figma type scale with explicit line-heights.
// '2xl' = Figma H1 (22px/lh30), 'xl' = H2 (20px/lh28), 'md' = body (16px/lh24),
// 'sm' = subtext (14px/lh18) — NOT the Tailwind defaults (24px / lh20).
const SIZE_CLASSES: Record<TextSize, string> = {
  '2xl': 'text-[22px] leading-[30px]',
  xl: 'text-xl leading-[28px]',
  lg: 'text-lg leading-7',
  md: 'text-base leading-6',
  sm: 'text-sm leading-[18px]',
  xs: 'text-xs leading-4',
};

// Weights map to Figma Roboto Flex axis values:
// regular=300 (body), medium=452 (button label), semibold=600, bold=800 (headings).
const WEIGHT_CLASSES: Record<TextWeight, string> = {
  regular: 'font-light',
  medium: 'font-[452]',
  semibold: 'font-semibold',
  bold: 'font-extrabold',
};

export function Text({
  tag = 'span',
  size = 'md',
  weight = 'regular',
  uppercase = false,
  capitalize = false,
  center = false,
  asChild = false,
  className,
  children,
  ref,
  ...props
}: TextProps): JSX.Element {
  // Polymorphic render target: an intrinsic tag or the Slot. Cast to an ElementType that accepts our
  // forwarded ref + HTML attributes so the dynamic `tag` union doesn't narrow the ref to one element type.
  const Component = (asChild ? Slot : tag) as ElementType<
    HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }
  >;
  return (
    <Component
      ref={ref}
      className={clsx(
        SIZE_CLASSES[size],
        WEIGHT_CLASSES[weight],
        center && 'text-center',
        capitalize && !uppercase && 'capitalize',
        uppercase && 'uppercase',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
