import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AppSocket } from './socketEvents';
import { SocketProvider } from './SocketProvider';
import { useSocket } from '../hooks/useSocket';

const mockDisconnect = vi.fn();
const mockSocket = { disconnect: mockDisconnect } as unknown as AppSocket;

vi.mock('./socketClient', () => ({
  createSocket: () => mockSocket,
}));

describe('SocketProvider', () => {
  beforeEach(() => {
    mockDisconnect.mockReset();
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
});

describe('useSocket outside provider', () => {
  it('throws if used outside SocketProvider', () => {
    expect(() => renderHook(() => useSocket())).toThrow('useSocket must be used within a SocketProvider');
  });
});
