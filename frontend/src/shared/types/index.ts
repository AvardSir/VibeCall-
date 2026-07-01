export type RoomStatus = 'available' | 'full' | 'not-found';
export type JoinError = 'FULL' | 'INVALID_NAME' | 'NOT_FOUND' | 'INTERNAL';

export type JoinResponse = {
  accessToken: string;
  livekitUrl: string;
  role: 'host' | 'guest';
  identity: string;
  displayName: string;
  roomId: string;
};

export type CreateRoomResponse = { roomId: string; hostToken: string };

// Generic envelope for API calls: a discriminated success/error union.
export type ApiResponse<TData, TError> =
  | { ok: true; data: TData }
  | { ok: false; error: TError };

export type JoinResult = ApiResponse<JoinResponse, JoinError>;
export type CreateRoomResult = ApiResponse<CreateRoomResponse, 'INTERNAL'>;

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

export type CallParticipant = {
  identity: string;
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
};
