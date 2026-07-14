import { io } from 'socket.io-client';
import type { AppSocket } from './socketEvents';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// The Socket.IO server is attached to the same origin as the REST control plane.
// autoConnect is off: the SocketProvider owns the connection lifecycle (connect on mount,
// disconnect on unmount) so it stays correct across a StrictMode setup→cleanup→setup cycle.
export function createSocket(): AppSocket {
  return io(BASE_URL, { autoConnect: false }) as AppSocket;
}
