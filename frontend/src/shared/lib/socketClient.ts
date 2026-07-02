import { io } from 'socket.io-client';
import type { AppSocket } from './socketEvents';
import { apiBaseUrl } from './env';

// The Socket.IO server is attached to the same origin as the REST control plane.
// autoConnect is off: the SocketProvider owns the connection lifecycle (connect on mount,
// disconnect on unmount) so it stays correct across a StrictMode setup→cleanup→setup cycle.
export function createSocket(): AppSocket {
  return io(apiBaseUrl, { autoConnect: false }) as AppSocket;
}
