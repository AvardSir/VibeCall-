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

// Sizes map to Tailwind's default type scale (this repo defines no custom `text-display-*`/`text-md`
// tokens). Add a `variant: 'display' | 'text'` axis here if a display scale is ever added to the theme.
const SIZE_CLASSES: Record<TextSize, string> = {
  '2xl': 'text-2xl',
  xl: 'text-xl',
  lg: 'text-lg',
  md: 'text-base',
  sm: 'text-sm',
  xs: 'text-xs',
};

const WEIGHT_CLASSES: Record<TextWeight, string> = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
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
