import type { RoomRegistry } from './rooms.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import { logger } from './logger.js';

export type GraceDeps = {
  registry: Pick<RoomRegistry, 'get' | 'startGraceState' | 'clearGraceState' | 'markEnded'>;
  admin: Pick<LivekitAdmin, 'deleteRoom'>;
  graceSeconds: number;
  onTick: (roomId: string, secondsLeft: number) => void;
  onCancelled: (roomId: string) => void;
  onEnded: (roomId: string, reason: 'grace_expired') => void;
  onCleanup?: (roomId: string) => void;
  now?: () => number;
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (handle: ReturnType<typeof setInterval>) => void;
};

export type GraceService = {
  startGrace(roomId: string): void;
  cancelGrace(roomId: string): void;
  isInGrace(roomId: string): boolean;
  /**
   * Current countdown for a room in grace, computed on demand (same `Math.ceil` basis as the
   * per-second tick), or `null` when the room is not in grace. Lets a socket that joins mid-grace
   * be handed the live value immediately instead of waiting for the next ~1s broadcast.
   */
  remainingSeconds(roomId: string): number | null;
};

export function createGraceService(deps: GraceDeps): GraceService {
  const now = deps.now ?? ((): number => Date.now());
  const setIv = deps.setIntervalFn ?? ((h, ms) => setInterval(h, ms));
  const clearIv = deps.clearIntervalFn ?? ((h) => clearInterval(h));
  const timers = new Map<string, ReturnType<typeof setInterval>>();
  const endsAtByRoom = new Map<string, number>();

  function stop(roomId: string): void {
    const t = timers.get(roomId);
    if (t !== undefined) { clearIv(t); timers.delete(roomId); }
    endsAtByRoom.delete(roomId);
  }

  function endExpired(roomId: string): void {
    stop(roomId);
    // Best-effort LiveKit teardown; mark ended regardless so revisits resolve to S2.
    void deps.admin.deleteRoom(roomId).catch((err: unknown) => logger.error({ err, room: roomId }, 'grace deleteRoom failed'));
    deps.registry.markEnded(roomId);
    deps.onCleanup?.(roomId);
    deps.onEnded(roomId, 'grace_expired');
  }

  return {
    startGrace(roomId) {
      if (timers.has(roomId)) return; // idempotent
      const endsAt = now() + deps.graceSeconds * 1000;
      endsAtByRoom.set(roomId, endsAt);
      deps.registry.startGraceState(roomId, endsAt);
      deps.onTick(roomId, deps.graceSeconds);
      const handle = setIv(() => {
        const secondsLeft = Math.ceil((endsAt - now()) / 1000);
        if (secondsLeft > 0) deps.onTick(roomId, secondsLeft);
        else endExpired(roomId);
      }, 1000);
      timers.set(roomId, handle);
    },
    cancelGrace(roomId) {
      if (!timers.has(roomId)) return;
      stop(roomId);
      deps.registry.clearGraceState(roomId);
      deps.onCancelled(roomId);
    },
    isInGrace(roomId) {
      return timers.has(roomId);
    },
    remainingSeconds(roomId) {
      const endsAt = endsAtByRoom.get(roomId);
      if (endsAt === undefined) return null;
      const secondsLeft = Math.ceil((endsAt - now()) / 1000);
      return secondsLeft > 0 ? secondsLeft : null;
    },
  };
}
