import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { RemovedScreen } from './RemovedScreen';

describe('RemovedScreen', () => {
  it('shows the removed-by-host message and a back-to-home link', () => {
    render(
      <MemoryRouter>
        <RemovedScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('You were removed from the call by the host.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
