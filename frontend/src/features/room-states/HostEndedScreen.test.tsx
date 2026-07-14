import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { HostEndedScreen } from './HostEndedScreen';

describe('HostEndedScreen', () => {
  it('shows the host-ended message and a back-to-home link', () => {
    render(
      <MemoryRouter>
        <HostEndedScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('The host has ended the call.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });
});
