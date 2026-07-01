import { z } from 'zod';
import urlJoin from 'url-join';
import type { CreateRoomResult, JoinError, JoinResult, RoomStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Endpoint URL builders kept in one place so paths are not scattered across call sites.
const roomsUrl = (): string => urlJoin(BASE_URL, 'rooms');
const roomStatusUrl = (roomId: string): string => urlJoin(roomsUrl(), encodeURIComponent(roomId));
const joinUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'join');

// Runtime schema kept ONLY on the joinRoom SUCCESS path: accessToken/livekitUrl feed straight into
// the LiveKit SDK, so a malformed reply must fail loudly rather than become a cryptic media error.
// createRoom and getRoomStatus are low-stakes (a bad roomId just surfaces as NOT_FOUND when used) →
// schema-free per the "validate only security-critical payloads" rule (20-frontend-structure.md).
// This preserves the post-MR3 apiClient convention — do NOT add schemas to createRoom/status/error.
const joinResponseSchema = z.object({
  accessToken: z.string(),
  livekitUrl: z.string(),
  role: z.enum(['host', 'guest']),
  identity: z.string(),
  displayName: z.string(),
  roomId: z.string(),
});

export async function createRoom(): Promise<CreateRoomResult> {
  const res = await fetch(roomsUrl(), { method: 'POST' });
  if (!res.ok) return { ok: false, error: 'INTERNAL' };
  // Low-stakes cast: roomId/hostToken only build a URL; a malformed one surfaces as NOT_FOUND when
  // the link is used, so a runtime schema here would be ceremony without a safety benefit.
  const data = (await res.json().catch(() => null)) as { roomId: string; hostToken: string } | null;
  if (data === null) return { ok: false, error: 'INTERNAL' };
  return { ok: true, data };
}

export async function getRoomStatus(roomId: string): Promise<RoomStatus> {
  const res = await fetch(roomStatusUrl(roomId));
  if (res.status === 404) return 'not-found';
  if (!res.ok) throw new Error('Unexpected room status response');
  return ((await res.json()) as { status: RoomStatus }).status;
}

export async function joinRoom(roomId: string, name: string, hostToken?: string): Promise<JoinResult> {
  const payload = hostToken !== undefined ? { name, hostToken } : { name };
  const res = await fetch(joinUrl(roomId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const parsed = joinResponseSchema.safeParse(await res.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'INTERNAL' };
  }
  // Error branch is low-stakes → documented cast, no schema (matches the post-MR3 convention).
  const body = (await res.json().catch(() => ({}))) as { error?: JoinError };
  return { ok: false, error: body.error ?? 'INTERNAL' };
}
