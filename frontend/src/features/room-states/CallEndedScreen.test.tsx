import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { CallEndedScreen } from './CallEndedScreen';

describe('CallEndedScreen', () => {
  it('shows the call-ended message and a start-new-call link', () => {
    render(
      <MemoryRouter>
        <CallEndedScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('This call has ended.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a new call/i })).toHaveAttribute('href', '/');
  });
});
