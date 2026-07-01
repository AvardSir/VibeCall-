import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { GuestLeftScreen } from './GuestLeftScreen';

describe('GuestLeftScreen', () => {
  it('shows the left-call message and calls onRejoin when Rejoin is clicked', async () => {
    const onRejoin = vi.fn();
    render(
      <MemoryRouter>
        <GuestLeftScreen onRejoin={onRejoin} />
      </MemoryRouter>,
    );
    expect(screen.getByText('You have left the call.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /rejoin/i }));
    expect(onRejoin).toHaveBeenCalledTimes(1);
  });
});
