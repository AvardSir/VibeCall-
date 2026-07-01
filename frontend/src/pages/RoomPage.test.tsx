import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';
import '../shared/i18n';

const getRoomStatus = vi.fn();
const joinRoom = vi.fn();
const endCall = vi.fn();
vi.mock('../shared/lib/apiClient', () => ({
  getRoomStatus: (...a: unknown[]) => getRoomStatus(...a),
  joinRoom: (...a: unknown[]) => joinRoom(...a),
  endCall: (...a: unknown[]) => endCall(...a),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

let onConnectErrorCallback: (() => void) | null = null;
let onLeaveCallback: (() => void) | null = null;
let onEndCallCallback: (() => void) | null = null;
let onRoomEndedCallback: ((reason: string) => void) | null = null;
let onRemovedCallback: (() => void) | null = null;

type MockCallShellProps = {
  onConnectError: () => void;
  onLeave: () => void;
  onEndCall: () => void;
  onRoomEnded: (reason: string) => void;
  onRemoved: () => void;
  role: string;
};

vi.mock('../features/call', () => ({
  CallShell: ({ onConnectError, onLeave, onEndCall, onRoomEnded, onRemoved, role }: MockCallShellProps) => {
    onConnectErrorCallback = onConnectError;
    onLeaveCallback = onLeave;
    onEndCallCallback = onEndCall;
    onRoomEndedCallback = onRoomEnded;
    onRemovedCallback = onRemoved;
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
  endCall.mockReset();
  navigate.mockReset();
  onConnectErrorCallback = null;
  onLeaveCallback = null;
  onEndCallCallback = null;
  onRoomEndedCallback = null;
  onRemovedCallback = null;
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

  it('reaches the call view after joining under StrictMode (mountedRef must survive the remount)', async () => {
    // StrictMode mounts→cleans up→remounts effects in dev. The mountedRef guard in handleEnter
    // must not be left false by that cleanup, or the post-join `if (!mountedRef.current) return`
    // silently strands the user on the connecting screen. This mirrors the real dev app.
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: true, data: { accessToken: 'j', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann', roomId: 'r1' } });
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/r/r1']}>
          <Routes>
            <Route path="/r/:roomId" element={<RoomPage />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(screen.getByText(/in-call-shell role:guest/)).toBeInTheDocument());
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

  it('shows the call-ended screen when the room status is ended on mount', async () => {
    getRoomStatus.mockResolvedValue('ended');
    renderAt('/r/r1');
    await waitFor(() => expect(screen.getByText('This call has ended.')).toBeInTheDocument());
  });

  async function enterCall(role: 'guest' | 'host' = 'guest'): Promise<void> {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({
      ok: true,
      data: { accessToken: 'j', livekitUrl: 'ws://x', role, identity: 'p_1', displayName: 'Ann', roomId: 'r1' },
    });
    renderAt(role === 'host' ? '/r/r1#h=secret' : '/r/r1');
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: role === 'host' ? /enter call/i : /^join$/i }));
    await waitFor(() => expect(screen.getByText(new RegExp(`in-call-shell role:${role}`))).toBeInTheDocument());
  }

  it('shows the guest-left screen on leave, and Rejoin returns to pre-join', async () => {
    await enterCall('guest');
    getRoomStatus.mockClear();
    await act(async () => { onLeaveCallback?.(); });
    await waitFor(() => expect(screen.getByText('You have left the call.')).toBeInTheDocument());
    // Leaving must not recheck capacity.
    expect(getRoomStatus).not.toHaveBeenCalled();

    getRoomStatus.mockResolvedValue('available');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /rejoin/i })); });
    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toBeInTheDocument());
  });

  it('shows the host-ended screen when onRoomEnded fires with host_ended', async () => {
    await enterCall('guest');
    await act(async () => { onRoomEndedCallback?.('host_ended'); });
    await waitFor(() => expect(screen.getByText('The host has ended the call.')).toBeInTheDocument());
  });

  it('shows the grace-expired screen when onRoomEnded fires with grace_expired', async () => {
    await enterCall('guest');
    await act(async () => { onRoomEndedCallback?.('grace_expired'); });
    await waitFor(() =>
      expect(screen.getByText('The host has disconnected and the call has ended.')).toBeInTheDocument(),
    );
  });

  it('shows the removed screen when onRemoved fires', async () => {
    await enterCall('guest');
    await act(async () => { onRemovedCallback?.(); });
    await waitFor(() => expect(screen.getByText('You were removed from the call by the host.')).toBeInTheDocument());
  });

  it('host onEndCall awaits endCall then navigates home', async () => {
    endCall.mockResolvedValue(true);
    await enterCall('host');
    await act(async () => { onEndCallCallback?.(); });
    await waitFor(() => expect(endCall).toHaveBeenCalledWith('r1', 'secret'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
  });
});
