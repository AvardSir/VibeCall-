export type RoomStatus = 'available' | 'full' | 'not-found' | 'ended';
export type JoinError = 'FULL' | 'INVALID_NAME' | 'NOT_FOUND' | 'INTERNAL';

// Must stay identical to the backend RoomEndReason in backend/src/socket.ts.
export type RoomEndReason = 'host_ended' | 'grace_expired';

export type JoinResponse = {
  accessToken: string;
  livekitUrl: string;
  role: 'host' | 'guest';
  identity: string;
  displayName: string;
  roomId: string;
  memberToken: string;
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

export type AttachmentKind = 'image' | 'file';

// Must stay identical to the backend Attachment in backend/src/attachments.ts.
export type Attachment = {
  fileId: string;
  name: string;
  size: number;
  mime: string;
  kind: AttachmentKind;
  url: string;
};

export type UploadErrorCode = 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'FORBIDDEN' | 'INTERNAL';

export type UploadResult = ApiResponse<Attachment, UploadErrorCode>;

export type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text?: string;
  attachments: Attachment[];
  // Present only on the live broadcast of a just-sent own message: the sender's optimistic-bubble id,
  // echoed by the server so the sender reconciles the exact bubble. Absent in history.
  clientId?: string;
};

export type CallParticipant = {
  identity: string;
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  // True while LiveKit reports this participant as an active speaker (drives the speaking ring).
  isSpeaking?: boolean;
};
