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
});
