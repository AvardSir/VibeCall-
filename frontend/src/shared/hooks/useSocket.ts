import { useContext } from 'react';
import { SocketContext } from '../lib/SocketProvider';
import type { AppSocket } from '../lib/socketEvents';

export function useSocket(): AppSocket {
  const socket = useContext(SocketContext);
  if (socket === null) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return socket;
}
