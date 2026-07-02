import { z } from 'zod';
import urlJoin from 'url-join';
import type { Attachment, CreateRoomResult, JoinError, JoinResult, RoomStatus, UploadResult } from '../types';
import { apiBaseUrl } from './env';

// Endpoint URL builders kept in one place so paths are not scattered across call sites.
const roomsUrl = (): string => urlJoin(apiBaseUrl, 'rooms');
const roomStatusUrl = (roomId: string): string => urlJoin(roomsUrl(), encodeURIComponent(roomId));
const joinUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'join');
const endUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'end');
const removeUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'remove');
const attachmentsUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'attachments');

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
  memberToken: z.string(),
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
  if (res.status === 410) return 'ended';
  if (res.status === 404) return 'not-found';
  if (!res.ok) throw new Error('Unexpected room status response');
  return ((await res.json()) as { status: RoomStatus }).status;
}

// Low-stakes host actions: the response body carries no data we act on, so the boolean success
// flag (res.ok) is all callers need — no schema, matching the post-MR3 convention.
export async function endCall(roomId: string, hostToken: string): Promise<boolean> {
  const res = await fetch(endUrl(roomId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  return res.ok;
}

export async function removeParticipant(roomId: string, hostToken: string, targetIdentity: string): Promise<boolean> {
  const res = await fetch(removeUrl(roomId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, targetIdentity }),
  });
  return res.ok;
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

// Low-stakes success path: the attachment body only carries display/download metadata, so a
// light cast is enough (no schema), matching the post-MR3 convention.
export async function uploadAttachment(roomId: string, memberToken: string, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(attachmentsUrl(roomId), {
    method: 'POST',
    headers: { 'x-member-token': memberToken },
    body: form,
  });
  if (res.ok) {
    const data = (await res.json()) as Attachment;
    return { ok: true, data };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err = body.error;
  return {
    ok: false,
    error: err === 'UNSUPPORTED_TYPE' || err === 'FILE_TOO_LARGE' || err === 'FORBIDDEN' ? err : 'INTERNAL',
  };
}

// Absolute URL: attachment.url is a backend-relative path, so a native <img>/<a> using it as-is
// would resolve against the Vite dev server, not the backend — hence the BASE_URL prefix.
export function attachmentDownloadUrl(attachment: Attachment, memberToken: string): string {
  return `${urlJoin(apiBaseUrl, attachment.url)}?token=${encodeURIComponent(memberToken)}`;
}
