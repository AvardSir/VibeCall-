import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('inlines the bundled SVG markup for the named glyph', () => {
    const { container } = render(<Icon name="micOn" className="h-[30px] w-[30px]" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass('h-[30px]', 'w-[30px]');
    expect(wrapper.innerHTML).toContain('<svg');
    expect(wrapper).toHaveAttribute('aria-hidden');
  });
});
