import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AppSocket } from './socketEvents';
import { SocketProvider } from './SocketProvider';
import { useSocket } from '../hooks/useSocket';

const mockConnect = vi.fn(() => {
  mockSocket.connected = true;
});
const mockDisconnect = vi.fn(() => {
  mockSocket.connected = false;
});
const mockSocket = {
  connected: false,
  connect: mockConnect,
  disconnect: mockDisconnect,
} as unknown as AppSocket & { connected: boolean };

vi.mock('./socketClient', () => ({
  createSocket: () => mockSocket,
}));

describe('SocketProvider', () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockDisconnect.mockClear();
    mockSocket.connected = false;
  });

  it('provides the socket to consumers via useSocket', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );
    const { result } = renderHook(() => useSocket(), { wrapper });
    expect(result.current).toBe(mockSocket);
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = render(<SocketProvider><div /></SocketProvider>);
    expect(mockDisconnect).not.toHaveBeenCalled();
    unmount();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it('leaves the socket connected after a StrictMode setup→cleanup→setup cycle', () => {
    // StrictMode (dev) runs effects setup→cleanup→setup. The cleanup disconnects; the provider
    // must reconnect on the re-setup, or the socket is left dead and no server events arrive
    // (chat_history / others' chat_message never reach the client).
    render(
      <StrictMode>
        <SocketProvider><div /></SocketProvider>
      </StrictMode>,
    );
    expect(mockConnect).toHaveBeenCalled();
    expect(mockSocket.connected).toBe(true);
  });
});

describe('useSocket outside provider', () => {
  it('throws if used outside SocketProvider', () => {
    expect(() => renderHook(() => useSocket())).toThrow('useSocket must be used within a SocketProvider');
  });
});
