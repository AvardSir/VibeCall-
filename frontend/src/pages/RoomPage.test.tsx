import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../shared/i18n';

const getRoomStatus = vi.fn();
const joinRoom = vi.fn();
vi.mock('../shared/lib/apiClient', () => ({
  getRoomStatus: (...a: unknown[]) => getRoomStatus(...a),
  joinRoom: (...a: unknown[]) => joinRoom(...a),
}));

let onConnectErrorCallback: (() => void) | null = null;
vi.mock('../features/call', () => ({
  CallShell: ({ onConnectError, role }: { onConnectError: () => void; role: string }) => {
    onConnectErrorCallback = onConnectError;
    return <div>in-call-shell role:{role}</div>;
  },
  ConnectingScreen: () => <div>connecting</div>,
}));

vi.mock('../features/chat', () => ({
  ChatPanel: ({ role }: { role: string }) => <div>chat-panel role:{role}</div>,
}));

import { RoomPage } from './RoomPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/r/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
  getRoomStatus.mockReset();
  joinRoom.mockReset();
  onConnectErrorCallback = null;
});
afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
});

describe('RoomPage', () => {
  it('shows the invalid-link screen when the room is not found', async () => {
    getRoomStatus.mockResolvedValue('not-found');
    renderAt('/r/ghost');
    await waitFor(() => expect(screen.getByText('This call was not found.')).toBeInTheDocument());
  });

  it('shows the full screen when the room is full', async () => {
    getRoomStatus.mockResolvedValue('full');
    renderAt('/r/r1');
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
  });

  it('shows the guest entry label and joins as guest (no hash token)', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: true, data: { accessToken: 'j', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann', roomId: 'r1' } });
    renderAt('/r/r1');
    await waitFor(() => screen.getByLabelText(/your name/i));
    expect(screen.getByRole('button', { name: /^join$/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(screen.getByText(/in-call-shell role:guest/)).toBeInTheDocument());
    expect(joinRoom).toHaveBeenCalledWith('r1', 'Ann', undefined);
  });

  it('passes the hash host token to joinRoom and enters as host', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: true, data: { accessToken: 'j', livekitUrl: 'ws://x', role: 'host', identity: 'p_1', displayName: 'Host', roomId: 'r1' } });
    renderAt('/r/r1#h=secret');
    await waitFor(() => screen.getByLabelText(/your name/i));
    expect(screen.getByRole('button', { name: /enter call/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Host' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(screen.getByText(/in-call-shell role:host/)).toBeInTheDocument());
    expect(joinRoom).toHaveBeenCalledWith('r1', 'Host', 'secret');
  });

  it('shows an inline error and returns to pre-join when join fails with INTERNAL', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: false, error: 'INTERNAL' });
    renderAt('/r/r1');
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() =>
      expect(screen.getByText(/unable to connect to the call service/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^join$/i })).toBeInTheDocument();
  });

  it('shows the connect-error screen when CallShell reports a connect error', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: true, data: { accessToken: 'j', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann', roomId: 'r1' } });
    renderAt('/r/r1');
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(screen.getByText(/in-call-shell role:guest/)).toBeInTheDocument());
    await act(async () => { onConnectErrorCallback?.(); });
    await waitFor(() => expect(screen.getByText(/unable to connect to the call service/i)).toBeInTheDocument());
  });
});
