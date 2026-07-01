import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders the trigger child', () => {
    render(
      <Tooltip label="Leave the call">
        <button type="button">Leave</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('exposes the label via a tooltip role, without changing the trigger accessible name', () => {
    render(
      <Tooltip label="Leave the call">
        <button type="button">Leave</button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Leave the call');
    // The tooltip bubble is a sibling, so the button's accessible name stays "Leave".
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('renders a white Figma bubble with the label', () => {
    render(
      <Tooltip label="Turn off camera">
        <button type="button">cam</button>
      </Tooltip>,
    );
    const bubble = screen.getByRole('tooltip');
    expect(bubble).toHaveTextContent('Turn off camera');
    expect(bubble).toHaveClass('bg-white', 'text-surface', 'rounded-[8px]', 'px-3', 'py-1.5', 'text-sm', 'font-semibold');
  });

  it('places above the trigger by default and below when placement="bottom"', () => {
    const { rerender } = render(
      <Tooltip label="x">
        <button type="button">t</button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveClass('bottom-full');

    rerender(
      <Tooltip label="x" placement="bottom">
        <button type="button">t</button>
      </Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveClass('top-full');
  });
});
