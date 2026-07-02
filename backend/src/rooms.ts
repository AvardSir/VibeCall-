import { randomBytes } from 'node:crypto';

export type RoomStatus = 'active' | 'grace' | 'ending' | 'ended';

export type Room = {
  roomId: string; // participant-facing id (no secret); ≥128-bit entropy (NFR-7)
  hostToken: string; // secret; grants the host role; ≥128-bit entropy (NFR-6)
  hostIdentity: string | null; // recorded on host join — foundation for M4 (grace, remove)
  createdAt: number;
  status: RoomStatus; // lifecycle state (M4); starts 'active'
  graceEndsAt: number | null; // epoch ms the grace period ends, else null
  memberTokens: Map<string, string>; // identity → token; authorizes attachment upload/download (M5)
  activeSharerId: string | null; // identity of the current screen sharer, else null (M6)
};

export type ShareClaimResult = { ok: true } | { ok: false; code: 'BUSY' | 'NOT_FOUND' };

export type RoomRegistry = {
  create(): Room;
  get(roomId: string): Room | undefined;
  verifyHostToken(roomId: string, token: string): boolean;
  setHostIdentity(roomId: string, identity: string): void;
  setStatus(roomId: string, status: RoomStatus): void;
  markEnded(roomId: string): void;
  startGraceState(roomId: string, endsAt: number): void;
  clearGraceState(roomId: string): void;
  recordMemberToken(roomId: string, identity: string): string;
  verifyMemberToken(roomId: string, token: string): boolean;
  revokeMemberToken(roomId: string, identity: string): void;
  claimShare(roomId: string, identity: string): ShareClaimResult;
  releaseShare(roomId: string, identity: string): boolean;
  clearShare(roomId: string): boolean;
  getActiveSharer(roomId: string): string | null;
};

export type RoomRegistryOptions = {
  now?: () => number;
  newToken?: () => string;
};

// 16 bytes = 128 bits; base64url yields a URL-safe 22-char string with no padding.
function defaultToken(): string {
  return randomBytes(16).toString('base64url');
}

export function createRoomRegistry(options: RoomRegistryOptions = {}): RoomRegistry {
  const now = options.now ?? ((): number => Date.now());
  const newToken = options.newToken ?? defaultToken;
  const rooms = new Map<string, Room>();

  return {
    create(): Room {
      const room: Room = {
        roomId: newToken(),
        hostToken: newToken(),
        hostIdentity: null,
        createdAt: now(),
        status: 'active',
        graceEndsAt: null,
        memberTokens: new Map(),
        activeSharerId: null,
      };
      rooms.set(room.roomId, room);
      return room;
    },
    get(roomId: string): Room | undefined {
      return rooms.get(roomId);
    },
    verifyHostToken(roomId: string, token: string): boolean {
      const room = rooms.get(roomId);
      // 128-bit entropy makes guessing/enumeration infeasible; plain compare is sufficient.
      return room !== undefined && room.hostToken === token;
    },
    setHostIdentity(roomId: string, identity: string): void {
      const room = rooms.get(roomId);
      if (room) room.hostIdentity = identity;
    },
    setStatus(roomId: string, status: RoomStatus): void {
      const room = rooms.get(roomId);
      if (room) room.status = status;
    },
    markEnded(roomId: string): void {
      const room = rooms.get(roomId);
      if (room) {
        room.status = 'ended';
        room.graceEndsAt = null;
      }
    },
    startGraceState(roomId: string, endsAt: number): void {
      const room = rooms.get(roomId);
      if (room) {
        room.status = 'grace';
        room.graceEndsAt = endsAt;
      }
    },
    clearGraceState(roomId: string): void {
      const room = rooms.get(roomId);
      if (room) {
        room.status = 'active';
        room.graceEndsAt = null;
      }
    },
    recordMemberToken(roomId: string, identity: string): string {
      const room = rooms.get(roomId);
      if (!room) return '';
      const token = newToken();
      room.memberTokens.set(identity, token);
      return token;
    },
    verifyMemberToken(roomId: string, token: string): boolean {
      const room = rooms.get(roomId);
      if (!room) return false;
      for (const t of room.memberTokens.values()) if (t === token) return true;
      return false;
    },
    revokeMemberToken(roomId: string, identity: string): void {
      const room = rooms.get(roomId);
      if (!room) return;
      room.memberTokens.delete(identity);
    },
    claimShare(roomId: string, identity: string): ShareClaimResult {
      const room = rooms.get(roomId);
      if (!room) return { ok: false, code: 'NOT_FOUND' };
      if (room.activeSharerId !== null && room.activeSharerId !== identity) return { ok: false, code: 'BUSY' };
      room.activeSharerId = identity;
      return { ok: true };
    },
    releaseShare(roomId: string, identity: string): boolean {
      const room = rooms.get(roomId);
      if (!room || room.activeSharerId !== identity) return false;
      room.activeSharerId = null;
      return true;
    },
    clearShare(roomId: string): boolean {
      const room = rooms.get(roomId);
      if (!room || room.activeSharerId === null) return false;
      room.activeSharerId = null;
      return true;
    },
    getActiveSharer(roomId: string): string | null {
      return rooms.get(roomId)?.activeSharerId ?? null;
    },
  };
}
