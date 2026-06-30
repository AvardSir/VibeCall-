import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import './shared/i18n';

const getRoomStatus = vi.fn();
const joinRoom = vi.fn();
vi.mock('./shared/lib/apiClient', () => ({
  getRoomStatus: (...a: unknown[]) => getRoomStatus(...a),
  joinRoom: (...a: unknown[]) => joinRoom(...a),
}));

let onConnectErrorCallback: (() => void) | null = null;
vi.mock('./features/call', () => ({
  CallShell: ({ onConnectError }: { onConnectError: () => void }) => {
    onConnectErrorCallback = onConnectError;
    return <div>in-call-shell</div>;
  },
  ConnectingScreen: () => <div>connecting</div>,
}));

beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
  getRoomStatus.mockReset();
  joinRoom.mockReset();
  onConnectErrorCallback = null;
});

afterEach(async () => {
  // Flush pending microtasks/macrotasks so any trailing async effects (e.g.
  // useDevicePermissions' getUserMedia call) complete while navigator is still
  // stubbed. Without this, the last test's effect can resolve after
  // vi.unstubAllGlobals() restores jsdom's real navigator (which has no
  // mediaDevices), causing "Cannot read properties of undefined" on the next tick.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
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

  it('shows the theme and language controls on the full-room screen', async () => {
    getRoomStatus.mockResolvedValue('full');
    render(<App />);
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /russian/i })).toBeInTheDocument();
  });

  it('shows the theme and language controls on the pre-join screen', async () => {
    getRoomStatus.mockResolvedValue('available');
    render(<App />);
    await waitFor(() => screen.getByLabelText(/your name/i));
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it('renders connect-error view when onConnectError is called', async () => {
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
    // Simulate LiveKit onConnectError callback
    expect(onConnectErrorCallback).not.toBeNull();
    onConnectErrorCallback!();
    await waitFor(() =>
      expect(
        screen.getByText(/Unable to connect to the call service/i),
      ).toBeInTheDocument(),
    );
  });
});
