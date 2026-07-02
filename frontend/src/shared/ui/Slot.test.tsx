import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slot } from './Slot';

describe('Slot', () => {
  it('renders its child element, merging className and forwarding props', () => {
    render(
      <Slot className="from-slot" data-testid="s">
        <button className="from-child" type="button">
          go
        </button>
      </Slot>,
    );
    const el = screen.getByRole('button', { name: 'go' });
    expect(el).toHaveClass('from-slot', 'from-child');
    expect(el).toHaveAttribute('data-testid', 's');
  });

  it("lets the child's own props win over the slot's (except merged className)", () => {
    render(
      <Slot title="slot-title">
        <span title="child-title">x</span>
      </Slot>,
    );
    expect(screen.getByText('x')).toHaveAttribute('title', 'child-title');
  });

  it('returns null when the child is not a valid element', () => {
    const { container } = render(<Slot>just a string</Slot>);
    expect(container).toBeEmptyDOMElement();
  });
});
