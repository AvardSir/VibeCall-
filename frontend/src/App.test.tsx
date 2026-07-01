import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import './shared/i18n';

vi.mock('./pages/LandingPage', () => ({ LandingPage: () => <div>landing</div> }));
vi.mock('./pages/RoomPage', () => ({ RoomPage: () => <div>room</div> }));

import { App } from './App';

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('App routing', () => {
  it('renders the landing page at /', () => {
    renderAt('/');
    expect(screen.getByText('landing')).toBeInTheDocument();
  });

  it('renders the room page at /r/:roomId', () => {
    renderAt('/r/r1');
    expect(screen.getByText('room')).toBeInTheDocument();
  });

  it('renders the invalid-link screen for an unknown path', () => {
    renderAt('/nonsense');
    expect(screen.getByText('This call was not found.')).toBeInTheDocument();
  });

  it('shows the theme and language controls on every screen', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RU' })).toBeInTheDocument();
  });
});
