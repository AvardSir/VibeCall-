import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { GraceExpiredScreen } from './GraceExpiredScreen';

describe('GraceExpiredScreen', () => {
  it('shows the grace-expired message and a back-to-home link', () => {
    render(
      <MemoryRouter>
        <GraceExpiredScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('The host has disconnected and the call has ended.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
