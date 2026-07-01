import { useEffect, useRef } from 'react';
import { useSocket } from '../../../shared/hooks/useSocket';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import type { RoomEndReason } from '../../../shared/types';

export type UseRoomLifecycleArgs = {
  identity: string;
  onRoomEnded: (reason: RoomEndReason) => void;
  onRemoved: () => void;
};

// Room-lifecycle socket events (grace countdown, room end, host-initiated removal). The
// subscribe/unsubscribe effect below intentionally depends only on [socket, setGrace] — `identity`,
// `onRoomEnded`, and `onRemoved` are read through a ref so a parent re-render (which hands us new
// callback references every time) does not tear down and re-subscribe the listeners. Re-subscribing
// on every render would churn socket.on/off needlessly and opens a race window where an event
// arriving between "off" and the next "on" is silently dropped.
export function useRoomLifecycle({ identity, onRoomEnded, onRemoved }: UseRoomLifecycleArgs): void {
  const socket = useSocket();
  const setGrace = useConnectionStore((s) => s.setGraceSecondsLeft);

  const argsRef = useRef({ identity, onRoomEnded, onRemoved });
  useEffect(() => {
    argsRef.current = { identity, onRoomEnded, onRemoved };
  }, [identity, onRoomEnded, onRemoved]);

  useEffect(() => {
    const onTick = (payload: { secondsLeft: number }): void => setGrace(payload.secondsLeft);
    const onCancelled = (): void => setGrace(null);
    const onEnded = (payload: { reason: RoomEndReason }): void => {
      argsRef.current.onRoomEnded(payload.reason);
    };
    const onParticipantRemoved = (payload: { identity: string }): void => {
      if (payload.identity === argsRef.current.identity) argsRef.current.onRemoved();
    };

    socket.on('grace_tick', onTick);
    socket.on('grace_cancelled', onCancelled);
    socket.on('room_ended', onEnded);
    socket.on('participant_removed', onParticipantRemoved);

    return () => {
      // Off the exact handler references registered above — never removeAllListeners()/disconnect(),
      // which belong to SocketProvider (the sole owner of the socket's lifecycle).
      socket.off('grace_tick', onTick);
      socket.off('grace_cancelled', onCancelled);
      socket.off('room_ended', onEnded);
      socket.off('participant_removed', onParticipantRemoved);
    };
  }, [socket, setGrace]);
}
