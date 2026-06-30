import { z } from 'zod';
import urlJoin from 'url-join';
import type { JoinResult, RoomStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Endpoint URL builders kept in one place so paths are not scattered across call sites.
// url-join normalizes separators (e.g. a trailing slash on BASE_URL) so segments never double up.
const roomStatusUrl = (roomName: string): string =>
  urlJoin(BASE_URL, 'rooms', encodeURIComponent(roomName));
const joinUrl = (roomName: string): string => urlJoin(roomStatusUrl(roomName), 'join');

// Response schemas — validate untrusted server payloads at the boundary instead of casting.
const roomStatusResponseSchema = z.object({ status: z.enum(['available', 'full']) });
const joinResponseSchema = z.object({
  accessToken: z.string(),
  livekitUrl: z.string(),
  role: z.literal('guest'),
  identity: z.string(),
  displayName: z.string(),
});
const errorBodySchema = z.object({ error: z.enum(['FULL', 'INVALID_NAME', 'INTERNAL']) });

export async function getRoomStatus(roomName: string): Promise<RoomStatus> {
  const res = await fetch(roomStatusUrl(roomName));
  const body: unknown = await res.json();
  const parsed = roomStatusResponseSchema.safeParse(body);
  if (parsed.success) return parsed.data.status;
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
    const parsed = joinResponseSchema.safeParse(data);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'INTERNAL' };
  }
  const body: unknown = await res.json().catch(() => ({}));
  const parsed = errorBodySchema.safeParse(body);
  return { ok: false, error: parsed.success ? parsed.data.error : 'INTERNAL' };
}
