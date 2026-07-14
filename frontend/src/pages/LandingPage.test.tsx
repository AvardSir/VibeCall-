import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../shared/i18n';

const createRoom = vi.fn();
const navigate = vi.fn();
vi.mock('../shared/lib/apiClient', () => ({ createRoom: (...a: unknown[]) => createRoom(...a) }));
vi.mock('react-router-dom', async (orig: () => Promise<Record<string, unknown>>) => ({
  ...(await orig()),
  useNavigate: () => navigate,
}));

import { LandingPage } from './LandingPage';

beforeEach(() => {
  createRoom.mockReset();
  navigate.mockReset();
});

describe('LandingPage', () => {
  it('renders the tagline and start button', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByText(/no sign-up required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start a call/i })).toBeInTheDocument();
  });

  it('navigates to the host URL (with hash token) on success', async () => {
    createRoom.mockResolvedValue({ ok: true, data: { roomId: 'r1', hostToken: 'h1' } });
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start a call/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/r/r1#h=h1'));
  });

  it('shows an inline error on failure and keeps the button enabled', async () => {
    createRoom.mockResolvedValue({ ok: false, error: 'INTERNAL' });
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start a call/i }));
    await waitFor(() =>
      expect(screen.getByText('Unable to start a call right now. Please try again.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /start a call/i })).toBeEnabled();
  });
});
