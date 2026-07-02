import { createContext, useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { createSocket } from './socketClient';
import type { AppSocket } from './socketEvents';

export const SocketContext = createContext<AppSocket | null>(null);

type SocketProviderProps = {
  children: ReactNode;
};

export function SocketProvider({ children }: SocketProviderProps): JSX.Element {
  const [socket] = useState<AppSocket>(() => createSocket());

  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
