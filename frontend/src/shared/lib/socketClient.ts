import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// The Socket.IO server is attached to the same origin as the REST control plane.
export function createSocket(): Socket {
  return io(BASE_URL, { autoConnect: true });
}
