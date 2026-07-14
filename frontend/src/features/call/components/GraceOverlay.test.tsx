import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { GraceOverlay } from './GraceOverlay';

it('shows the waiting message and the countdown', () => {
  render(<GraceOverlay secondsLeft={47} />);
  expect(screen.getByText('The host lost connection. Waiting for them to return...')).toBeInTheDocument();
  expect(screen.getByText('Reconnecting... 47s')).toBeInTheDocument();
});
