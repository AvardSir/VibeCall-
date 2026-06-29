import type { JoinError, JoinResponse, JoinResult, RoomStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function getRoomStatus(roomName: string): Promise<RoomStatus> {
  const res = await fetch(`${BASE_URL}/rooms/${encodeURIComponent(roomName)}`);
  const body = (await res.json()) as { status: RoomStatus };
  return body.status;
}

export async function joinRoom(roomName: string, name: string): Promise<JoinResult> {
  const res = await fetch(`${BASE_URL}/rooms/${encodeURIComponent(roomName)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    return { ok: true, data: (await res.json()) as JoinResponse };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: JoinError };
  return { ok: false, error: body.error ?? 'INTERNAL' };
}
