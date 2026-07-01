import { randomBytes } from 'node:crypto';

export type Room = {
  roomId: string; // participant-facing id (no secret); ≥128-bit entropy (NFR-7)
  hostToken: string; // secret; grants the host role; ≥128-bit entropy (NFR-6)
  hostIdentity: string | null; // recorded on host join — foundation for M4 (grace, remove)
  createdAt: number;
};

export type RoomRegistry = {
  create(): Room;
  get(roomId: string): Room | undefined;
  verifyHostToken(roomId: string, token: string): boolean;
  setHostIdentity(roomId: string, identity: string): void;
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
  };
}
