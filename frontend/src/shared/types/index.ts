export type RoomStatus = 'available' | 'full';
export type JoinError = 'FULL' | 'INVALID_NAME' | 'INTERNAL';

export type JoinResponse = {
  accessToken: string;
  livekitUrl: string;
  role: 'guest';
  identity: string;
  displayName: string;
};

export type JoinResult =
  | { ok: true; data: JoinResponse }
  | { ok: false; error: JoinError };
