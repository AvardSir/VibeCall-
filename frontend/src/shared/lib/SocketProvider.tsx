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
    // Connect on (re)mount and disconnect on cleanup. StrictMode runs this setup→cleanup→setup;
    // reconnecting on the second setup is what keeps the socket alive (a cleanup-only effect would
    // leave it disconnected, so no chat history or incoming messages would ever arrive).
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
