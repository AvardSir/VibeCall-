import type { JoinError, JoinResponse, JoinResult, RoomStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Endpoint URL builders kept in one place so paths are not scattered across call sites.
const roomStatusUrl = (roomName: string): string =>
  `${BASE_URL}/rooms/${encodeURIComponent(roomName)}`;
const joinUrl = (roomName: string): string => `${roomStatusUrl(roomName)}/join`;

function isRoomStatus(value: unknown): value is RoomStatus {
  return value === 'available' || value === 'full';
}

function isJoinError(value: unknown): value is JoinError {
  return value === 'FULL' || value === 'INVALID_NAME' || value === 'INTERNAL';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJoinResponse(value: unknown): value is JoinResponse {
  return (
    isRecord(value) &&
    typeof value.accessToken === 'string' &&
    typeof value.livekitUrl === 'string' &&
    value.role === 'guest' &&
    typeof value.identity === 'string' &&
    typeof value.displayName === 'string'
  );
}

export async function getRoomStatus(roomName: string): Promise<RoomStatus> {
  const res = await fetch(roomStatusUrl(roomName));
  const body: unknown = await res.json();
  if (isRecord(body) && isRoomStatus(body.status)) return body.status;
  throw new Error('Malformed room status response');
}

export async function joinRoom(roomName: string, name: string): Promise<JoinResult> {
  const res = await fetch(joinUrl(roomName), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    const data: unknown = await res.json();
    if (isJoinResponse(data)) return { ok: true, data };
    return { ok: false, error: 'INTERNAL' };
  }
  const body: unknown = await res.json().catch(() => ({}));
  const error = isRecord(body) && isJoinError(body.error) ? body.error : 'INTERNAL';
  return { ok: false, error };
}
