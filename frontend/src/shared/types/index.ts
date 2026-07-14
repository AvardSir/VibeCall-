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

export type ParticipantRole = 'host' | 'guest';

export type ChatErrorCode = 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' | 'NOT_A_MEMBER';

export type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text: string;
};
