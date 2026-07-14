/**
 * Regression test: verifies SocketProvider is mounted around the in-call view.
 *
 * Uses the REAL ChatPanel (not mocked) so that useChat → useSocket() actually
 * runs. Without <SocketProvider> it would throw
 * "useSocket must be used within a SocketProvider".
 *
 * socket.io-client is mocked to return a lightweight fake socket so no real
 * network connection is attempted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../shared/i18n';

// ---------------------------------------------------------------------------
// socket.io-client: return a fake socket that satisfies SocketProvider + useChat
// ---------------------------------------------------------------------------
const fakeSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock('socket.io-client', () => ({
  io: () => fakeSocket,
}));

// ---------------------------------------------------------------------------
// apiClient mocks
// ---------------------------------------------------------------------------
const getRoomStatus = vi.fn();
const joinRoom = vi.fn();
vi.mock('../shared/lib/apiClient', () => ({
  getRoomStatus: (...a: unknown[]) => getRoomStatus(...a),
  joinRoom: (...a: unknown[]) => joinRoom(...a),
}));

// ---------------------------------------------------------------------------
// features/call: stub CallShell and ConnectingScreen (media not relevant here)
// ---------------------------------------------------------------------------
vi.mock('../features/call', () => ({
  CallShell: ({ role }: { role: string }) => <div>in-call-shell role:{role}</div>,
  ConnectingScreen: () => <div>connecting</div>,
}));

// features/chat is NOT mocked — real ChatPanel runs so useSocket() is exercised.

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
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
  });
  getRoomStatus.mockReset();
  joinRoom.mockReset();
  fakeSocket.on.mockReset();
  fakeSocket.off.mockReset();
  fakeSocket.emit.mockReset();
  fakeSocket.connect.mockReset();
  fakeSocket.disconnect.mockReset();
});

afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
});

describe('RoomPage — SocketProvider regression', () => {
  it('renders in-call view with real ChatPanel without throwing useSocket error', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({
      ok: true,
      data: {
        accessToken: 'tok',
        livekitUrl: 'ws://livekit',
        role: 'guest',
        identity: 'p_1',
        displayName: 'Ann',
        roomId: 'r1',
      },
    });

    renderAt('/r/r1');

    // Pre-join screen should appear
    await waitFor(() => screen.getByLabelText(/your name/i));

    // Submit the join form
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));

    // The stubbed CallShell text proves we reached in-call.
    // If SocketProvider is missing, useSocket() throws and this never renders.
    await waitFor(() =>
      expect(screen.getByText(/in-call-shell role:guest/)).toBeInTheDocument(),
    );

    // The real ChatPanel also mounted without error (its aside is in the DOM).
    expect(document.querySelector('aside[aria-labelledby="chat-panel-title"]')).not.toBeNull();
  });
});
