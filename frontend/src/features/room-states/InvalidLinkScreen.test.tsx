import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { InvalidLinkScreen } from './InvalidLinkScreen';

describe('InvalidLinkScreen', () => {
  it('shows the not-found message and a start-new-call link', () => {
    render(
      <MemoryRouter>
        <InvalidLinkScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('This call was not found.')).toBeInTheDocument();
    expect(screen.getByText('The link may be incorrect or expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a new call/i })).toHaveAttribute('href', '/');
  });
});
