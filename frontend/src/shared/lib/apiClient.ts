import { z } from 'zod';
import urlJoin from 'url-join';
import type { JoinError, JoinResult, RoomStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Endpoint URL builders kept in one place so paths are not scattered across call sites.
// url-join normalizes separators (e.g. a trailing slash on BASE_URL) so segments never double up.
const roomStatusUrl = (roomName: string): string =>
  urlJoin(BASE_URL, 'rooms', encodeURIComponent(roomName));
const joinUrl = (roomName: string): string => urlJoin(roomStatusUrl(roomName), 'join');

// Generic fetch wrapper — states the expected type, no runtime schema.
// The two deliberate `as` casts below (here and in the error branch of joinRoom) are documented:
// low-stakes paths where a runtime schema would be ceremony without safety benefit.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = init !== undefined ? await fetch(url, init) : await fetch(url);
  return (await res.json()) as T;
}

// Runtime schema kept only on the joinRoom SUCCESS path: the token fields feed directly into the
// LiveKit SDK, so a blind cast there would turn a malformed backend reply into a cryptic media
// failure. getRoomStatus and the error branch are low-stakes → schema-free.
const joinResponseSchema = z.object({
  accessToken: z.string(),
  livekitUrl: z.string(),
  role: z.literal('guest'),
  identity: z.string(),
  displayName: z.string(),
});

export async function getRoomStatus(roomName: string): Promise<RoomStatus> {
  return (await request<{ status: RoomStatus }>(roomStatusUrl(roomName))).status;
}

export async function joinRoom(roomName: string, name: string): Promise<JoinResult> {
  const res = await fetch(joinUrl(roomName), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    const parsed = joinResponseSchema.safeParse(await res.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'INTERNAL' };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: JoinError };
  return { ok: false, error: body.error ?? 'INTERNAL' };
}
