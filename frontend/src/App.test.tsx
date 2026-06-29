import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import './shared/i18n';

const getRoomStatus = vi.fn();
const joinRoom = vi.fn();
vi.mock('./shared/lib/apiClient', () => ({
  getRoomStatus: (...a: unknown[]) => getRoomStatus(...a),
  joinRoom: (...a: unknown[]) => joinRoom(...a),
}));
vi.mock('./features/call', () => ({
  CallShell: () => <div>in-call-shell</div>,
  ConnectingScreen: () => <div>connecting</div>,
}));

beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
  getRoomStatus.mockReset();
  joinRoom.mockReset();
});

import { App } from './App';

describe('App routing', () => {
  it('renders S1 when the room is full', async () => {
    getRoomStatus.mockResolvedValue('full');
    render(<App />);
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
  });

  it('renders pre-join when the room is available', async () => {
    getRoomStatus.mockResolvedValue('available');
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toBeInTheDocument());
  });

  it('routes to S1 if join returns FULL', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: false, error: 'FULL' });
    render(<App />);
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
  });

  it('enters the call on a successful join', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({
      ok: true,
      data: { accessToken: 'jwt', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann' },
    });
    render(<App />);
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(screen.getByText('in-call-shell')).toBeInTheDocument());
  });
});
