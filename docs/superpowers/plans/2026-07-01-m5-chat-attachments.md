# M5 — Chat Attachments + Image Lightbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let participants attach images and files to chat messages — stage ≤5 files (type/size validated) behind a paperclip, upload them over HTTP, relay the metadata over Socket.IO, render images as clickable thumbnails and files as download chips, and open images full-size in a dismissible lightbox.

**Architecture:** Files travel over **HTTP, not the socket**: the client `POST`s each staged file to `POST /rooms/:roomId/attachments` (multipart, member-token auth), the backend validates + stores it on local disk under a room-scoped folder and returns `Attachment` metadata; the client then emits `send_message` with the metadata array, which the backend folds into the `ChatMessage` it stores + broadcasts. Downloads/thumbnails are served by an authenticated `GET /attachments/:roomName/:fileId/:name?token=<memberToken>` route. A new `memberToken` (issued at join) authorizes upload/download. The lightbox is a self-rolled focus-trapping overlay.

**Tech Stack:** Backend — Node 22 + TypeScript (strict, ESM), Express 5, **multer** (multipart), Node `fs/promises`, Socket.IO 4, Zod, Vitest. Frontend — React 19 + TypeScript, Vite, react-i18next, Zustand, `FormData`/`fetch`, Vitest + Testing Library.

## Global Constraints

- **PRD is binding** (`prd-kmb-video-chat.md`). Builds on the existing text-chat subsystem (Socket.IO relay, in-memory history, optimistic send, `Sending…`/`Not delivered`). Independent of M2–M4 in behavior, but **shares files with M4** (see "Coordination with M4").
- **Validation limits (PRD §6 row 3 / FR-26) — exact:**
  - **≤ 10 MB per file**; **≤ 5 attachments per message** (a 6th is rejected; the first 5 stay staged).
  - **Image types:** `PNG, JPEG, GIF, WebP`. **File types:** `PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP`.
  - Validated **both client-side and server-side**.
- **Verbatim UI error strings (EN)** — copy EXACTLY (trailing periods are load-bearing); RU parallel required for every key:
  - Unsupported type: `Unsupported file type.`
  - Oversize: `File exceeds 10 MB.`
  - Over-count: `You can attach up to 5 files per message.`
  - Attach control aria-label: `Attach files` · staged-remove aria-label: `Remove` · lightbox close aria-label: `Close` · file-chip download aria-label: `Download`
  - (Existing, reused: `Sending…`, `Not delivered`, `Send`, `Type a message…`, `{{length}}/1000`.)
- **Send is valid when** `text.trim().length > 0` **OR** `attachments.length ≥ 1` (widens the current `EMPTY_MESSAGE` rule). The 1000-char text limit is independent of attachments.
- **Lightbox (FR-27):** dim the background with a **semi-transparent** layer (NOT fully black); center the image, scale to fit the viewport preserving aspect ratio, **never enlarge beyond native size**; close via a `×` button (top corner), `Esc`, or backdrop click; **view-only — no download control inside the overlay**; on open move focus into the overlay, on close return focus to the originating thumbnail; the close button has an accessible label.
- **Non-image chips** show file name + size + a download control (browser download, no in-app preview).
- **Storage / auth (tech-design §3.5):** local disk at `<ATTACHMENT_STORAGE_PATH>/<roomName>/<fileId>__<sanitizedName>`. Upload auth: `x-member-token` header. Download auth: `?token=<memberToken>` query param (so native `<img src>`/`<a download>` carry it); non-members → `403`. Stored `Attachment.url` is **tokenless** (`/attachments/<roomName>/<fileId>/<name>`); each client appends its own token. Room folder deleted on room teardown; a startup sweep removes orphaned folders. **NFR-10:** no participant content persists after a room ends.
- **No antivirus scanning** (Non-Goal §9.15) — type + size validation only. MIME is client-supplied and trusted for this scope (tech-design §8).
- **Code rules:** no `any`/`console.log` (use `logger`)/inline `eslint-disable`/`@ts-ignore`, no hardcoded user-facing strings (i18n only), `PascalCase` types no `I`-prefix, string-literal unions, named exports, `import type` for types. Backend `npm run typecheck && npm run lint && npm test` and frontend `npm run typecheck` (**= `tsc -b`**) `&& npm run lint && npm test` stay clean. Tests co-located. Socket event maps are duplicated FE↔BE — add to BOTH identically.

## Coordination with M4 (read before executing)

**Resolved (2026-07-01): M4 is already present on this branch.** This plan's branch `feat/m5-chat-attachments` was cut from `feat/m3-host-guest-rooms`, which already contains the M3/M4 work (landing/rooms/roles + host lifecycle: `end` controller, grace `onEnded`, room-end teardown). So the file-overlap concern below is effectively resolved — **build directly on the current tree** and merge (never replace) the shared additions.

M5 and M4 both touch: `errors.ts` (ErrorCode union), `socket.ts` (events/deps), `rooms.ts`, `routes/rooms/controller.ts` (`join`/`end`), `config.ts`, `shared/types/index.ts`, `shared/lib/socketEvents.ts`, `useConnectionStore.ts`, `apiClient.ts`. When editing these, **extend the existing unions/event maps/deps objects in place** — do not overwrite M4's entries.
- **Cleanup wiring (M4 present):** hook `attachments.deleteRoomFolder(roomId)` (and the currently-missing `chat.clear(roomId)`) into the room-teardown path — M4's `end` controller **and** grace-expiry (`grace.ts` `endExpired`, via a new `onCleanup` callback). The startup orphan sweep remains the backstop for crash-orphaned folders. Do NOT rebuild M4's lifecycle here.

---

## Resolved Design Decisions (from the M5 requirements review)

All decisions below are locked (brainstorm 2026-07-01); none remain open.

- **D1 — HTTP upload → socket metadata** (spec-confirmed). Files never traverse the socket; `send_message` carries the full `Attachment[]` returned by the upload endpoint.
- **D2 — `memberToken` infrastructure is built in M5.** Decided 2026-07-01 (brainstorm): issue an opaque per-participant token at `/join` (spec §3.5). It doesn't exist yet. Minimal approach: the registry tracks per-room `memberTokens` (a `Set<string>` is sufficient — no identity mapping is needed for M5 auth); `join` issues one (`randomBytes(16).base64url`), stores it, and returns it; the FE keeps it in `useConnectionStore.localParticipant.memberToken`. Upload verifies the header token, download verifies the query token, both via `registry.verifyMemberToken(roomId, token)`.
- **D3 — `multer` for multipart**, memory storage (`multer.memoryStorage()`), so the service controls disk writes + validation before persisting. Add `multer` + `@types/multer` to backend deps.
- **D4/D5 — validate type by BOTH extension and MIME, on BOTH client and server.** Client gates staging (instant error, no round-trip); server re-validates (defense vs. spoof).
- **D6/D8 — token appended at render time.** Thumbnails: `<img src={attachment.url + '?token=' + memberToken}>`. File chips: `<a href={url + '?token=' + memberToken} download>`. Token is room-scoped + ephemeral; visible in devtools is acceptable per scope.
- **D7 — animated thumbnails are frozen to a still first frame (client-side canvas).** Decided 2026-07-01 (brainstorm). Non-animated images render via `<img>`; GIF/WebP (detected by `mime`) render into a `<canvas>` drawn from the first frame of an offscreen `Image`, so the list view is a **still** (FR-27). The lightbox uses a normal `<img>` and animates there. No server-side image library (avoids the `sharp`/musl risk noted in `CLAUDE.md`).
- **D9 — lightbox close `×` at top-right.**
- **D10 — staged attachments live in `useChatStore`** (`stagedAttachments`), per the store rules, so `canSend` and the panel can read them; cleared on successful send.
- **D11 — full `Attachment[]` in the `send_message` payload** (spec flow), so the server includes them in history + broadcast.
- **D12 — upload-on-send + simple resend semantics.** Decided 2026-07-01 (brainstorm): files are staged locally and validated on pick, then all staged files are uploaded **on Send**, before `send_message`. If ANY upload fails, the whole send fails → text + staged files retained (message shows `Not delivered`) → resend re-uploads all (new `fileId`s). Orphaned earlier uploads are reclaimed by the room-end cleanup / startup sweep. (No per-file resume.)

---

## File Structure

**Backend (`backend/src/`)**
- Create: `attachments.ts` (+ `attachments.test.ts`) — validation, disk storage, path resolution, `deleteRoomFolder`, `sweepOrphans`.
- Modify: `config.ts` / `config.test.ts` — `ATTACHMENT_STORAGE_PATH` (default `./uploads`), `MAX_ATTACHMENT_BYTES` const (10 MB).
- Modify: `errors.ts` / `errors.test.ts` — `UNSUPPORTED_TYPE` (415), `FILE_TOO_LARGE` (413), `FORBIDDEN` (403).
- Modify: `rooms.ts` / `rooms.test.ts` — per-room `memberTokens`; `recordMemberToken`, `verifyMemberToken`.
- Modify: `livekitTokens.ts` is unchanged; **`routes/rooms/controller.ts`** `join` issues + returns `memberToken`.
- Modify: `chat.ts` / `chat.test.ts` — `Attachment` type, `ChatMessage.attachments`, `build()` accepts attachments, conditional-empty validation.
- Modify: `socket.ts` / `socket.test.ts` — `SendMessagePayload.attachments`, count guard, pass to `build`.
- Create: `routes/attachments/uploadController.ts`, `downloadController.ts`, `router.ts` (+ tests) — OR fold into `routes/rooms`; this plan uses a dedicated `routes/attachments/`.
- Modify: `routes/index.ts`, `app.ts` — mount upload (`POST /rooms/:roomId/attachments`) + download (`GET /attachments/:roomName/:fileId/:name`); multer middleware.
- Modify: `server.ts` — construct `AttachmentService`, run startup sweep, wire teardown cleanup.
- Modify: `package.json` — add `multer` + `@types/multer`.

**Frontend (`frontend/src/`)**
- Modify: `shared/i18n/en.ts`, `ru.ts`, keys test — attachment strings.
- Modify: `shared/types/index.ts` — `Attachment`, `AttachmentKind`, `ChatMessage.attachments`, `JoinResponse.memberToken`, upload result type.
- Modify: `shared/lib/apiClient.ts` / test — `uploadAttachment(roomId, memberToken, file)`.
- Modify: `shared/lib/socketEvents.ts` — `send_message` payload gains `attachments`.
- Modify: `stores/useConnectionStore.ts` / test — `memberToken` in `LocalParticipant`.
- Modify: `stores/useChatStore.ts` / test — `ChatItem.attachments`, `stagedAttachments`, `addStaged`/`removeStaged`/`clearStaged`, updated `addOptimistic`/`toDelivered`.
- Create: `features/chat/lib/validateAttachment.ts` (+ test) — client-side type/size/count validation → verbatim error keys.
- Modify: `features/chat/hooks/useChat.ts` / test — `sendMessage(text, files)` async upload flow.
- Modify: `features/chat/components/ChatInput.tsx` / test — paperclip, staged list, inline errors, `canSend`.
- Modify: `features/chat/components/ChatMessageItem.tsx` / test — thumbnails + file chips.
- Create: `features/chat/components/ImageLightbox.tsx` (+ test) — the overlay.
- Modify: `features/chat/ChatPanel.tsx` — own the lightbox open/close state.

---

# Backend

### Task 1: `memberToken` on the registry

**Files:** Modify `backend/src/rooms.ts`, `rooms.test.ts`.

**Interfaces:**
- Produces: `RoomRegistry` gains `recordMemberToken(roomId: string, identity: string): string` (generates a 128-bit token, stores it keyed by identity, returns it; no-op returning `''` for unknown room) and `verifyMemberToken(roomId: string, token: string): boolean` (true iff some member of that room holds the token). Internal: each `Room` gains `memberTokens: Map<string, string>` (identity → token).

- [ ] **Step 1: Failing tests** — append to `rooms.test.ts`:

```ts
it('issues a distinct 128-bit member token per identity and verifies it', () => {
  const registry = createRoomRegistry();
  const room = registry.create();
  const t1 = registry.recordMemberToken(room.roomId, 'p_1');
  expect(t1).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(registry.verifyMemberToken(room.roomId, t1)).toBe(true);
  expect(registry.verifyMemberToken(room.roomId, 'nope')).toBe(false);
  expect(registry.verifyMemberToken('ghost', t1)).toBe(false);
});

it('recordMemberToken on an unknown room returns empty and stores nothing', () => {
  const registry = createRoomRegistry();
  expect(registry.recordMemberToken('ghost', 'p_1')).toBe('');
});
```

- [ ] **Step 2: Run** `cd backend && npx vitest run src/rooms.test.ts` → FAIL.
- [ ] **Step 3: Implement** — add `memberTokens: Map<string, string>` to `Room` (init `new Map()` in `create`), and the methods (reuse the existing 16-byte base64url generator):

```ts
    recordMemberToken(roomId, identity) {
      const room = rooms.get(roomId);
      if (!room) return '';
      const token = newToken(); // the existing randomBytes(16).base64url generator
      room.memberTokens.set(identity, token);
      return token;
    },
    verifyMemberToken(roomId, token) {
      const room = rooms.get(roomId);
      if (!room) return false;
      for (const t of room.memberTokens.values()) if (t === token) return true;
      return false;
    },
```

Add both to the `RoomRegistry` type. Update the deterministic-generator `toEqual` test (from M3 Task 1) to include `memberTokens: new Map()` if it asserts the whole object (or switch that assertion to `toMatchObject` of the scalar fields).

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): per-room member tokens for attachment auth"` (end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`).

---

### Task 2: Issue `memberToken` from `join`

**Files:** Modify `backend/src/routes/rooms/controller.ts`, `backend/src/app.test.ts`.

**Interfaces:** the `join` response gains `memberToken: string`. `RoomsControllerDeps.registry` must include `recordMemberToken` (widen the `Pick` if narrowed).

- [ ] **Step 1: Failing test** — in `app.test.ts`, extend the guest-join success assertion:

```ts
expect(res.body.memberToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
```

- [ ] **Step 2: Run** `npx vitest run src/app.test.ts` → FAIL.
- [ ] **Step 3: Implement** — in `join`, after `identity` is generated and role decided, and after `setHostIdentity` (host case), issue the token and include it in the response:

```ts
    const memberToken = registry.recordMemberToken(roomId, identity);
    res.json({ accessToken, livekitUrl: config.livekitUrl, role, identity, displayName: name, roomId, memberToken });
```

(If the deps `registry` was a `Pick`, add `recordMemberToken` to it; `createRoomRegistry` already provides it.)

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): return a member token from join"`.

---

### Task 3: Attachment config + error codes

**Files:** Modify `backend/src/config.ts`, `config.test.ts`, `errors.ts`, `errors.test.ts`.

**Interfaces:** `AppConfig` gains `attachmentStoragePath: string`; export `MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024`. `ErrorCode` gains `'UNSUPPORTED_TYPE'` (415), `'FILE_TOO_LARGE'` (413), `'FORBIDDEN'` (403).

- [ ] **Step 1: Failing tests** — `config.test.ts`:

```ts
it('defaults the attachment storage path and honours the override', () => {
  expect(loadConfig(base).attachmentStoragePath).toBe('./uploads');
  expect(loadConfig({ ...base, ATTACHMENT_STORAGE_PATH: '/data/up' }).attachmentStoragePath).toBe('/data/up');
});
```

`errors.test.ts`:

```ts
it('maps attachment error codes', () => {
  expect(new AppError('UNSUPPORTED_TYPE').status).toBe(415);
  expect(new AppError('FILE_TOO_LARGE').status).toBe(413);
  expect(new AppError('FORBIDDEN').status).toBe(403);
});
```

- [ ] **Step 2: Run** both → FAIL.
- [ ] **Step 3: Implement** — `config.ts`: add `ATTACHMENT_STORAGE_PATH: z.string().min(1).default('./uploads'),` to `envSchema`, `attachmentStoragePath: string;` to `AppConfig`, `attachmentStoragePath: e.ATTACHMENT_STORAGE_PATH,` to the return, and `export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;`. `errors.ts`: extend the union and the `STATUS_BY_CODE` map with `UNSUPPORTED_TYPE: StatusCodes.UNSUPPORTED_MEDIA_TYPE, FILE_TOO_LARGE: StatusCodes.REQUEST_TOO_LONG, FORBIDDEN: StatusCodes.FORBIDDEN,`.

> If M4 already added `ENDED`, MERGE — keep it alongside the three new codes.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): attachment storage config + 415/413/403 error codes"`.

---

### Task 4: Attachment service (`attachments.ts`)

**Files:** Create `backend/src/attachments.ts`, `attachments.test.ts`.

**Interfaces:**
- Produces: `AttachmentKind = 'image' | 'file'`; `Attachment = { fileId: string; name: string; size: number; mime: string; kind: AttachmentKind; url: string }`; `AttachmentService = { validateAndStore(input: { roomName: string; originalName: string; mime: string; buffer: Buffer }): Promise<Attachment>; resolvePath(roomName: string, fileId: string): Promise<string | null>; deleteRoomFolder(roomName: string): Promise<void>; sweepOrphans(liveRoomIds: string[]): Promise<void> }`. `validateAndStore` throws `AppError('UNSUPPORTED_TYPE')` / `AppError('FILE_TOO_LARGE')`. `createAttachmentService(deps: { storageRoot: string; maxBytes: number; newId?: () => string; fs?: FsLike })`.

Allowlist (extension→mime→kind):

```ts
const ALLOWED: Record<string, { mimes: string[]; kind: AttachmentKind }> = {
  png:  { mimes: ['image/png'], kind: 'image' },
  jpg:  { mimes: ['image/jpeg'], kind: 'image' },
  jpeg: { mimes: ['image/jpeg'], kind: 'image' },
  gif:  { mimes: ['image/gif'], kind: 'image' },
  webp: { mimes: ['image/webp'], kind: 'image' },
  pdf:  { mimes: ['application/pdf'], kind: 'file' },
  doc:  { mimes: ['application/msword'], kind: 'file' },
  docx: { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], kind: 'file' },
  xls:  { mimes: ['application/vnd.ms-excel'], kind: 'file' },
  xlsx: { mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], kind: 'file' },
  txt:  { mimes: ['text/plain'], kind: 'file' },
  zip:  { mimes: ['application/zip', 'application/x-zip-compressed'], kind: 'file' },
};
```

Validation: derive the extension from `originalName` (lowercased, after the last `.`); reject if not in `ALLOWED` OR the mime isn't in that entry's `mimes` → `UNSUPPORTED_TYPE`. Reject `buffer.length > maxBytes` → `FILE_TOO_LARGE`. Sanitize the name (strip path separators, keep `[\w.\- ]`), write to `<storageRoot>/<roomName>/<fileId>__<sanitized>`, return the `Attachment` with `url = /attachments/<roomName>/<fileId>/<sanitized>`.

- [ ] **Step 1: Failing tests** (inject an in-memory fs-like + deterministic ids):

```ts
import { describe, it, expect, vi } from 'vitest';
import { createAttachmentService } from './attachments.js';
import { AppError } from './errors.js';

function memFs() {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  return {
    files, dirs,
    mkdir: vi.fn(async (p: string) => { dirs.add(p); }),
    writeFile: vi.fn(async (p: string, b: Buffer) => { files.set(p, b); }),
    readdir: vi.fn(async () => [...dirs].map((d) => d.split('/').pop() as string)),
    rm: vi.fn(async (p: string) => { dirs.delete(p); }),
    access: vi.fn(async (p: string) => { if (![...files.keys()].some((k) => k.startsWith(p))) throw new Error('ENOENT'); }),
  };
}

function make() {
  let n = 0;
  const fs = memFs();
  const svc = createAttachmentService({ storageRoot: '/up', maxBytes: 10, newId: () => `f${n++}`, fs: fs as never });
  return { svc, fs };
}

describe('attachmentService.validateAndStore', () => {
  it('stores an allowed image and returns tokenless metadata', async () => {
    const { svc, fs } = make();
    const a = await svc.validateAndStore({ roomName: 'r1', originalName: 'cat.png', mime: 'image/png', buffer: Buffer.from('img') });
    expect(a).toMatchObject({ fileId: 'f0', name: 'cat.png', mime: 'image/png', kind: 'image', size: 3, url: '/attachments/r1/f0/cat.png' });
    expect(fs.writeFile).toHaveBeenCalledWith('/up/r1/f0__cat.png', expect.any(Buffer));
  });
  it('rejects an unsupported type', async () => {
    const { svc } = make();
    await expect(svc.validateAndStore({ roomName: 'r1', originalName: 'a.exe', mime: 'application/octet-stream', buffer: Buffer.from('x') }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });
  it('rejects a mismatched mime for a good extension', async () => {
    const { svc } = make();
    await expect(svc.validateAndStore({ roomName: 'r1', originalName: 'a.png', mime: 'text/plain', buffer: Buffer.from('x') }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });
  it('rejects an oversize file', async () => {
    const { svc } = make();
    await expect(svc.validateAndStore({ roomName: 'r1', originalName: 'a.txt', mime: 'text/plain', buffer: Buffer.alloc(11) }))
      .rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
  it('classifies a document as kind=file', async () => {
    const { svc } = make();
    const a = await svc.validateAndStore({ roomName: 'r1', originalName: 'doc.pdf', mime: 'application/pdf', buffer: Buffer.from('x') });
    expect(a.kind).toBe('file');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/attachments.test.ts` → FAIL.
- [ ] **Step 3: Implement** `attachments.ts` — use the injected `fs` (default to `node:fs/promises` + `randomBytes` id) and the `ALLOWED` map above. `resolvePath` finds the stored file by `<storageRoot>/<roomName>/` + a filename starting `<fileId>__` (readdir + prefix match), returns the full path or `null`. `deleteRoomFolder` = `fs.rm(join(storageRoot, roomName), { recursive: true, force: true })`. `sweepOrphans(liveRoomIds)` = readdir the storage root, `rm` any subfolder not in `liveRoomIds`. Log via `logger`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): attachment service (validate + local-disk store + cleanup)"`.

---

### Task 5: Chat model — attachments

**Files:** Modify `backend/src/chat.ts`, `chat.test.ts`.

**Interfaces:** `ChatMessage` gains `attachments: Attachment[]` (imports `Attachment` from `attachments.js`). `build()` input gains `attachments?: Attachment[]` (default `[]`). Validation: text may be empty **iff** `attachments.length > 0`. Add a validator `validateMessage({ text, attachmentCount })` (or extend the existing) that returns `EMPTY_MESSAGE` only when both text is blank AND `attachmentCount === 0`, and `TEXT_TOO_LONG` when `text.length > 1000`.

- [ ] **Step 1: Failing tests** — append to `chat.test.ts`:

```ts
it('allows an empty text when attachments are present', () => {
  const chat = createChatService();
  const v = chat.validateMessage({ text: '   ', attachmentCount: 1 });
  expect(v.ok).toBe(true);
});
it('still rejects empty text with no attachments', () => {
  const chat = createChatService();
  expect(chat.validateMessage({ text: '', attachmentCount: 0 })).toMatchObject({ ok: false, code: 'EMPTY_MESSAGE' });
});
it('build carries attachments onto the message', () => {
  const chat = createChatService();
  const att = { fileId: 'f0', name: 'c.png', size: 3, mime: 'image/png', kind: 'image' as const, url: '/attachments/r1/f0/c.png' };
  const m = chat.build({ roomName: 'r1', senderIdentity: 'p_1', senderName: 'Ann', text: '', attachments: [att] });
  expect(m.attachments).toEqual([att]);
});
```

- [ ] **Step 2: Run** `npx vitest run src/chat.test.ts` → FAIL.
- [ ] **Step 3: Implement** — import `Attachment`; add `attachments: Attachment[]` to `ChatMessage`; in `build`, set `attachments: input.attachments ?? []`; add/adjust `validateMessage({ text, attachmentCount })` per the rule above. Keep the existing `validateText` (used elsewhere) or route it through the new validator; keep `ChatErrorCode` unchanged (`EMPTY_MESSAGE | TEXT_TOO_LONG | NOT_A_MEMBER`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): chat messages carry attachments; empty text ok with files"`.

---

### Task 6: Socket send with attachments

**Files:** Modify `backend/src/socket.ts`, `socket.test.ts`.

**Interfaces:** `SendMessagePayload` gains `attachments?: Attachment[]`. `handleSendMessage` caps attachments at 5 (extra → `message_failed { code: 'TOO_MANY_ATTACHMENTS' }` — add this to `ChatErrorCode`), validates via `chat.validateMessage`, and passes `attachments` to `chat.build`. **Preserve** the MR3/M4 typed maps, `ChatServer`/`ChatSocket`, guarded listeners — MERGE.

- [ ] **Step 1: Failing test** — append to `socket.test.ts` (adapt to the file's `makeSocket`/`makeDeps`):

```ts
it('relays a message with attachments and empty text', () => {
  const io = makeIo();
  const socket = boundSocket({ identity: 'p_1', displayName: 'Ann', roomName: 'r1' }); // helper that presets binding
  const att = { fileId: 'f0', name: 'c.png', size: 3, mime: 'image/png', kind: 'image', url: '/attachments/r1/f0/c.png' };
  handleSendMessage(socket, io, makeDeps(), { text: '', attachments: [att] });
  expect(io.emitted.at(-1)).toMatchObject(['chat_message', expect.objectContaining({ attachments: [att] })]);
});
it('rejects more than 5 attachments', () => {
  const io = makeIo();
  const socket = boundSocket({ identity: 'p_1', displayName: 'Ann', roomName: 'r1' });
  const atts = Array.from({ length: 6 }, (_, i) => ({ fileId: `f${i}`, name: 'c.png', size: 1, mime: 'image/png', kind: 'image', url: `/attachments/r1/f${i}/c.png` }));
  handleSendMessage(socket, io, makeDeps(), { text: 'hi', attachments: atts });
  expect(socket.emitted).toContainEqual(['message_failed', { code: 'TOO_MANY_ATTACHMENTS' }]);
});
```

> Adapt the "already-bound socket" setup to the file's existing helpers (it may set `socket.data.binding` directly).

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — extend `SendMessagePayload` (and the FE-mirrored comment), add `'TOO_MANY_ATTACHMENTS'` to `ChatErrorCode` (in `chat.ts`), and in `handleSendMessage`:

```ts
  const attachments = payload?.attachments ?? [];
  if (attachments.length > 5) { socket.emit('message_failed', { code: 'TOO_MANY_ATTACHMENTS' }); return; }
  const validation = deps.chat.validateMessage({ text: payload?.text ?? '', attachmentCount: attachments.length });
  if (!validation.ok) { socket.emit('message_failed', { code: validation.code }); return; }
  const message = deps.chat.build({ roomName: binding.roomName, senderIdentity: binding.identity, senderName: binding.displayName, text: validation.value ?? '', attachments });
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): socket send_message carries validated attachments"`.

---

### Task 7: Upload endpoint

**Files:** Create `backend/src/routes/attachments/uploadController.ts`, `router.ts`; modify `routes/index.ts`, `app.ts`, `package.json`. Test in `backend/src/routes/attachments/upload.test.ts` (or extend `app.test.ts`).

**Interfaces:** `POST /rooms/:roomId/attachments` — multipart single field `file`; auth via `x-member-token` header verified against the room; on success `201 { fileId, name, size, mime, kind, url }`; missing/invalid token → `403 FORBIDDEN`; unknown room → `404`; multer file-size limit set to `MAX_ATTACHMENT_BYTES` (its limit error maps to `413`); `validateAndStore` throws map to `415`/`413`. `UploadControllerDeps = { registry: Pick<RoomRegistry,'get'|'verifyMemberToken'>; attachments: Pick<AttachmentService,'validateAndStore'> }`.

- [ ] **Step 1: Install multer** — `cd backend && npm install multer && npm install -D @types/multer`.
- [ ] **Step 2: Failing test** — with `supertest`, `.attach('file', Buffer.from('img'), 'c.png')` + `.set('x-member-token', token)`; assert `201` + body shape; a wrong token → `403`; a `.exe` → `415`. Build the app with a real registry (create room, `recordMemberToken`) + a stub attachment service.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** `uploadController.ts`:

```ts
import type { Request, Response } from 'express';
import type { RoomRegistry } from '../../rooms.js';
import type { AttachmentService } from '../../attachments.js';
import { AppError } from '../../errors.js';

export type UploadControllerDeps = {
  registry: Pick<RoomRegistry, 'get' | 'verifyMemberToken'>;
  attachments: Pick<AttachmentService, 'validateAndStore'>;
};

export function createUploadController(deps: UploadControllerDeps) {
  return async function upload(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (typeof roomId !== 'string' || !deps.registry.get(roomId)) throw new AppError('NOT_FOUND');
    const token = req.header('x-member-token');
    if (token === undefined || !deps.registry.verifyMemberToken(roomId, token)) throw new AppError('FORBIDDEN');
    const file = (req as Request & { file?: { originalname: string; mimetype: string; buffer: Buffer } }).file;
    if (!file) throw new AppError('UNSUPPORTED_TYPE');
    const attachment = await deps.attachments.validateAndStore({
      roomName: roomId, originalName: file.originalname, mime: file.mimetype, buffer: file.buffer,
    });
    res.status(201).json(attachment);
  };
}
```

`router.ts` for uploads:

```ts
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../asyncHandler.js';
import { createUploadController } from './uploadController.js';
import type { UploadControllerDeps } from './uploadController.js';
import { MAX_ATTACHMENT_BYTES } from '../../config.js';

export function createUploadRouter(deps: UploadControllerDeps): Router {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } });
  const router = Router();
  router.post('/:roomId/attachments', upload.single('file'), asyncHandler(createUploadController(deps)));
  return router;
}
```

Mount it under `/rooms` in `routes/index.ts` (same base as the rooms router) so the path is `POST /rooms/:roomId/attachments`. Map multer's `LIMIT_FILE_SIZE` error to `413` in the error edge (in `app.ts`'s error handler, translate `err.code === 'LIMIT_FILE_SIZE'` → `AppError('FILE_TOO_LARGE')`, or catch it in the controller). Widen `AppDeps` to carry `attachments`.

- [ ] **Step 5: Run** → PASS. **Step 6: Commit** — `git commit -m "feat(backend): authenticated multipart attachment upload endpoint"`.

---

### Task 8: Download endpoint

**Files:** Create `backend/src/routes/attachments/downloadController.ts`; modify `routes/index.ts`/`app.ts`. Test: `download.test.ts`.

**Interfaces:** `GET /attachments/:roomName/:fileId/:name` — auth via `?token=`; `403` on bad token; `404` if the room or file is missing; otherwise streams the file with `Content-Disposition: attachment; filename="<name>"` and a best-effort `Content-Type`. `DownloadControllerDeps = { registry: Pick<RoomRegistry,'get'|'verifyMemberToken'>; attachments: Pick<AttachmentService,'resolvePath'>; sendFile?: (res, path, name) => void }`.

- [ ] **Step 1: Failing test** — request without token → `403`; with valid token but unknown file → `404`; with valid token + resolvable path → calls the injected `sendFile` with the resolved path + name. Inject a stub `attachments.resolvePath` + `sendFile` spy.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**:

```ts
import type { Request, Response } from 'express';
import type { RoomRegistry } from '../../rooms.js';
import type { AttachmentService } from '../../attachments.js';
import { AppError } from '../../errors.js';

export type DownloadControllerDeps = {
  registry: Pick<RoomRegistry, 'get' | 'verifyMemberToken'>;
  attachments: Pick<AttachmentService, 'resolvePath'>;
  sendFile?: (res: Response, absolutePath: string, downloadName: string) => void;
};

export function createDownloadController(deps: DownloadControllerDeps) {
  const send = deps.sendFile ?? ((res, p, name) => { res.download(p, name); });
  return async function download(req: Request, res: Response): Promise<void> {
    const { roomName, fileId, name } = req.params as { roomName: string; fileId: string; name: string };
    if (!deps.registry.get(roomName)) throw new AppError('NOT_FOUND');
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (token === undefined || !deps.registry.verifyMemberToken(roomName, token)) throw new AppError('FORBIDDEN');
    const path = await deps.attachments.resolvePath(roomName, fileId);
    if (path === null) throw new AppError('NOT_FOUND');
    send(res, path, name);
  };
}
```

Mount at the app root (NOT under `/rooms`): `app.use(createDownloadRouter(deps))` where the router does `router.get('/attachments/:roomName/:fileId/:name', asyncHandler(createDownloadController(deps)))`. `res.download` sets `Content-Disposition` automatically.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): authenticated attachment download route"`.

---

### Task 9: Cleanup wiring + server composition + backend gate

**Files:** Modify `backend/src/server.ts`, `app.ts`.

- [ ] **Step 1: Wire** — in `server.ts` construct `const attachments = createAttachmentService({ storageRoot: config.attachmentStoragePath, maxBytes: MAX_ATTACHMENT_BYTES })`, pass it into `createApp` deps, and run a **startup sweep** best-effort: `void attachments.sweepOrphans([]).catch((err) => logger.error({ err }, 'attachment sweep failed'))` (the registry is empty at boot, so all existing folders are orphans from a prior run — NFR-10). **Teardown:** if M4 is present, call `attachments.deleteRoomFolder(roomId)` from the room-end path (M4 `end` controller + grace `onEnded`); wire it by passing `attachments.deleteRoomFolder` into those deps. If M4 is absent, leave a `// TODO(M4): delete room folder on room end` note and rely on the next startup sweep.
- [ ] **Step 2: Full backend gate** — `cd backend && npm run typecheck && npm run lint && npm test` → clean/PASS.
- [ ] **Step 3: Commit** — `git commit -m "feat(backend): wire attachment service, startup orphan sweep, teardown cleanup"`.

---

# Frontend

### Task 10: i18n attachment strings

**Files:** Modify `frontend/src/shared/i18n/en.ts`, `ru.ts`, keys test.

**Interfaces:** `chat` namespace gains `attach`, `removeAttachment`, `unsupportedType`, `fileTooLarge`, `tooManyFiles`, `closeLightbox`, `download`.

- [ ] **Step 1: Parity test (red)**:

```ts
it('exposes M5 chat attachment keys with parity', () => {
  for (const k of ['attach','removeAttachment','unsupportedType','fileTooLarge','tooManyFiles','closeLightbox','download'])
    expect(en.chat).toHaveProperty(k);
  expect(Object.keys(ru.chat)).toEqual(Object.keys(en.chat));
  expect(en.chat.unsupportedType).toBe('Unsupported file type.');
  expect(en.chat.fileTooLarge).toBe('File exceeds 10 MB.');
  expect(en.chat.tooManyFiles).toBe('You can attach up to 5 files per message.');
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Add EN** (into `chat`): `attach: 'Attach files', removeAttachment: 'Remove', unsupportedType: 'Unsupported file type.', fileTooLarge: 'File exceeds 10 MB.', tooManyFiles: 'You can attach up to 5 files per message.', closeLightbox: 'Close', download: 'Download',`. **RU:** `attach: 'Прикрепить файлы', removeAttachment: 'Удалить', unsupportedType: 'Неподдерживаемый тип файла.', fileTooLarge: 'Файл превышает 10 МБ.', tooManyFiles: 'Можно прикрепить не более 5 файлов к сообщению.', closeLightbox: 'Закрыть', download: 'Скачать',`.
- [ ] **Step 4: Run** `npx vitest run src/shared/i18n && npm run typecheck` → PASS/clean. **Step 5: Commit** — `git commit -m "feat(frontend): i18n for chat attachments (EN/RU)"`.

---

### Task 11: Shared types + socket payload + apiClient upload

**Files:** Modify `shared/types/index.ts`, `shared/lib/socketEvents.ts`, `shared/lib/apiClient.ts`, `apiClient.test.ts`.

**Interfaces:**
- `AttachmentKind = 'image' | 'file'`; `Attachment = { fileId, name, size, mime, kind, url }`; `ChatMessage.attachments: Attachment[]`; `JoinResponse.memberToken: string`; `UploadResult = { ok: true; data: Attachment } | { ok: false; error: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'FORBIDDEN' | 'INTERNAL' }`.
- `socketEvents.ts`: `send_message` payload gains `attachments?: Attachment[]`.
- `apiClient.ts`: `uploadAttachment(roomId, memberToken, file): Promise<UploadResult>` — `FormData`, `x-member-token` header, POST `/rooms/:roomId/attachments`; 201→`{ok:true,data}` (light cast per the post-MR3 convention — no schema on this low-stakes path), non-ok→map body `error` else `INTERNAL`. **Also** update `joinResponseSchema` to include `memberToken: z.string()` (join is the one schema-validated payload).

- [ ] **Step 1: Failing test** — `apiClient.test.ts`:

```ts
it('uploadAttachment posts FormData with the member token and parses the attachment', async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({ fileId: 'f0', name: 'c.png', size: 3, mime: 'image/png', kind: 'image', url: '/attachments/r1/f0/c.png' }) } as Response);
  const file = new File([new Uint8Array([1,2,3])], 'c.png', { type: 'image/png' });
  const r = await uploadAttachment('r1', 'm1', file);
  expect(r).toEqual({ ok: true, data: expect.objectContaining({ fileId: 'f0', kind: 'image' }) });
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  expect((init.headers as Record<string,string>)['x-member-token']).toBe('m1');
  expect(init.body).toBeInstanceOf(FormData);
});
it('maps an upload 415 to UNSUPPORTED_TYPE', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 415, json: () => Promise.resolve({ error: 'UNSUPPORTED_TYPE' }) } as Response);
  const file = new File([new Uint8Array([1])], 'a.exe', { type: 'application/octet-stream' });
  expect(await uploadAttachment('r1', 'm1', file)).toEqual({ ok: false, error: 'UNSUPPORTED_TYPE' });
});
```

Also update the existing join-success test to include `memberToken: 'm1'` in the mocked body + assertion.

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — add the types; extend `socketEvents.ts` (mirror backend Task 6, keep cross-ref comment); add to `apiClient.ts`:

```ts
const attachmentsUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'attachments');
export async function uploadAttachment(roomId: string, memberToken: string, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(attachmentsUrl(roomId), { method: 'POST', headers: { 'x-member-token': memberToken }, body: form });
  if (res.ok) { const data = (await res.json()) as Attachment; return { ok: true, data }; }
  const body = (await res.json().catch(() => ({}))) as { error?: UploadResult extends { ok: false } ? never : never };
  const err = (body as { error?: string }).error;
  return { ok: false, error: err === 'UNSUPPORTED_TYPE' || err === 'FILE_TOO_LARGE' || err === 'FORBIDDEN' ? err : 'INTERNAL' };
}
```

Add `memberToken: z.string()` to `joinResponseSchema` and `memberToken` to `JoinResponse`.

- [ ] **Step 4: Run** `npx vitest run src/shared/lib/apiClient.test.ts && npm run typecheck` → PASS/clean. **Step 5: Commit** — `git commit -m "feat(frontend): Attachment types + memberToken + uploadAttachment client"`.

---

### Task 12: connection store — memberToken

**Files:** Modify `frontend/src/stores/useConnectionStore.ts`, its test, and every `LocalParticipant` construction site (RoomPage `setLocalParticipant`, chat/store tests).

**Interfaces:** `LocalParticipant` gains `memberToken: string`.

- [ ] **Step 1: Test (red)** — assert a constructed `LocalParticipant` round-trips `memberToken`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — add `memberToken: string` to `LocalParticipant`; update `RoomPage.tsx`'s `setLocalParticipant({ identity, displayName, roomId, memberToken: result.data.memberToken })`; update every test/site constructing a `LocalParticipant` (typecheck will list them).
- [ ] **Step 4: Run** `npx vitest run src/stores && npm run typecheck` → PASS/clean. **Step 5: Commit** — `git commit -m "feat(frontend): carry memberToken on the local participant"`.

---

### Task 13: chat store — attachments + staging

**Files:** Modify `frontend/src/stores/useChatStore.ts`, `useChatStore.test.ts`.

**Interfaces:** `ChatItem` gains `attachments: Attachment[]`. `StagedFile = { id: string; file: File }`. State gains `stagedAttachments: StagedFile[]` + `addStaged(file: File): void`, `removeStaged(id: string): void`, `clearStaged(): void`. `addOptimistic` gains an `attachments` param; `toDelivered` maps `message.attachments`.

- [ ] **Step 1: Tests (red)**:

```ts
it('stages and removes files', () => {
  const s = useChatStore.getState();
  const f = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
  s.addStaged(f);
  const id = useChatStore.getState().stagedAttachments[0].id;
  expect(useChatStore.getState().stagedAttachments).toHaveLength(1);
  useChatStore.getState().removeStaged(id);
  expect(useChatStore.getState().stagedAttachments).toHaveLength(0);
});
it('optimistic + delivered items carry attachments', () => {
  const s = useChatStore.getState();
  const att = { fileId: 'f0', name: 'c.png', size: 3, mime: 'image/png', kind: 'image' as const, url: '/attachments/r1/f0/c.png' };
  s.addOptimistic('c1', '', { identity: 'p_1', displayName: 'Ann' } as never, [att]);
  expect(useChatStore.getState().messages.at(-1)?.attachments).toEqual([att]);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — extend `ChatItem`/`ChatState`; use an incrementing/`crypto.randomUUID()`-free id (e.g. a module counter) for staged ids; `addStaged/removeStaged/clearStaged`; thread `attachments` (default `[]`) through `addOptimistic` and `toDelivered`. Include `stagedAttachments: []` in any reset.
- [ ] **Step 4: Run** `npx vitest run src/stores/useChatStore.test.ts && npm run typecheck` → PASS/clean. **Step 5: Commit** — `git commit -m "feat(frontend): chat store tracks staged + delivered attachments"`.

---

### Task 14: client-side attachment validation

**Files:** Create `frontend/src/features/chat/lib/validateAttachment.ts`, `validateAttachment.test.ts`.

**Interfaces:** `validateStagedFile(file: File, currentCount: number): { ok: true } | { ok: false; errorKey: 'unsupportedType' | 'fileTooLarge' | 'tooManyFiles' }`. Uses the same allowlist + 10 MB + ≤5 rules as the backend; count check first (`currentCount >= 5` → `tooManyFiles`), then type, then size. Export `MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024` and the allowed extension set.

- [ ] **Step 1: Tests (red)** — `tooManyFiles` at count 5; `unsupportedType` for `.exe`; `fileTooLarge` for an 11 MB file; `ok` for a small `.png`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — mirror the backend allowlist (by extension; also check `file.type` against the entry's mimes when `file.type` is non-empty). **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): client-side attachment validation with verbatim error keys"`.

---

### Task 15: useChat — send with upload

**Files:** Modify `frontend/src/features/chat/hooks/useChat.ts`, `useChat.test.ts`.

**Interfaces:** `sendMessage(text: string, files: StagedFile[]): void` — uploads each file via `uploadAttachment(roomId, memberToken, file)`; if ALL succeed, `addOptimistic(clientId, text, localParticipant, attachments)` then `socket.emit('send_message', { text, attachments })` and `clearStaged()`; if ANY fails, mark the optimistic item failed (or skip optimistic and surface `Not delivered`), retain staged files + text (do not clear). Reads `memberToken`/`roomId` from `localParticipant`.

- [ ] **Step 1: Tests (red)** — mock `uploadAttachment`; (a) all-upload-succeeds → `send_message` emitted with the attachment metadata + staged cleared; (b) one upload fails → `send_message` NOT emitted, staged retained. Adapt to the hook's existing socket/store mocks.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — make `sendMessage` async internally (fire-and-forget with a `void` wrapper for the caller); gather `const results = await Promise.all(files.map((s) => uploadAttachment(roomId, memberToken, s.file)))`; `if (results.every((r) => r.ok))` proceed else fail-and-retain. **Step 4: Run** `npx vitest run src/features/chat/hooks/useChat.test.ts` → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): useChat uploads attachments then relays metadata"`.

---

### Task 16: ChatInput — paperclip + staging + errors

**Files:** Modify `frontend/src/features/chat/components/ChatInput.tsx`, `ChatInput.test.tsx`.

**Interfaces:** Adds a hidden `<input type="file" multiple accept="...">` triggered by a paperclip `<button aria-label={t('chat.attach')}>`; on select, runs `validateStagedFile` per file (respecting the running count) → `addStaged` on ok, else show the mapped inline error (`t('chat.'+errorKey)`); renders `stagedAttachments` above the textarea, each with a remove `× ` (`aria-label={t('chat.removeAttachment')}`) calling `removeStaged`; `canSend = text.trim().length > 0 || stagedAttachments.length > 0`; Send calls `sendMessage(text, stagedAttachments)`.

- [ ] **Step 1: Tests (red)** — selecting a valid image stages a chip; selecting a `.exe` shows `Unsupported file type.`; Send is enabled with 0 text + 1 staged file; a 6th file shows `You can attach up to 5 files per message.`. Use `fireEvent.change` on the file input with a `File[]` (jsdom supports `new File`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — accept string `accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"`; keep a local `error` state for the latest inline message (cleared on the next successful stage). Use `Text`/`Button`/`Tooltip` primitives. **Step 4: Run** `npx vitest run src/features/chat/components/ChatInput.test.tsx` → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): paperclip staging + inline validation in ChatInput"`.

---

### Task 17: AttachmentThumbnail (canvas-freeze) + file chips + ChatMessageItem

**Files:** Create `frontend/src/features/chat/components/AttachmentThumbnail.tsx`, `AttachmentThumbnail.test.tsx`; modify `frontend/src/features/chat/components/ChatMessageItem.tsx`, `ChatMessageItem.test.tsx`.

**Interfaces:**
- `AttachmentThumbnailProps = { src: string; name: string; animated: boolean; onOpen: () => void }`. When `animated` is false, render a clickable `<img src={src} alt={name}>`. When `animated` is true (GIF/WebP — see D7), render a `<canvas>` drawn from the **first frame** of an offscreen `Image(src)` (on `load`, size to a ≤160px box preserving aspect, `ctx.drawImage`), so the list view is a **still**; make it clickable (`role="button"`, `tabIndex={0}`, Enter/Space + click → `onOpen`).
- `ChatMessageItem`: for each `item.attachments`, compute `src = a.url.startsWith('blob:') ? a.url : attachmentDownloadUrl(a, memberToken)` (blob previews while sending; tokened URL once delivered). `kind === 'image'` → `<AttachmentThumbnail src={src} name={a.name} animated={a.mime === 'image/gif' || a.mime === 'image/webp'} onOpen={() => onOpenImage(src, a.name)} />`; `kind === 'file'` → a chip with name + humanized size + a download `<a href={src} download={a.name} aria-label={t('chat.download')}>`. `memberToken` comes from `useConnectionStore`; `attachmentDownloadUrl` from `apiClient` (Task 11). Add an `onOpenImage(src: string, alt: string)` prop threaded from `ChatPanel`.

- [ ] **Step 1: Tests (red)** —
  - `AttachmentThumbnail`: a non-animated image renders an `<img alt={name}>` and click calls `onOpen`; an `animated` thumbnail renders a `<canvas>` (assert `container.querySelector('canvas')`).
  - `ChatMessageItem`: an image attachment renders a thumbnail whose delivered `src` contains `?token=`; clicking it calls `onOpenImage`; a file attachment renders a download link with the token + file name/size. Seed `memberToken` in the store and pass an `onOpenImage` spy.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — build `AttachmentThumbnail` (canvas `useEffect` that loads the image and draws the first frame; `img.crossOrigin = 'anonymous'`); add a small `formatBytes` helper (e.g. `12.3 KB`); render both attachment branches in `ChatMessageItem`; keep existing text + `Sending…`/`Not delivered` rendering. **Step 4: Run** `npx vitest run src/features/chat/components/AttachmentThumbnail.test.tsx src/features/chat/components/ChatMessageItem.test.tsx` → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): canvas-freeze image thumbnails (animated still) + file download chips"`.

---

### Task 18: ImageLightbox

**Files:** Create `frontend/src/features/chat/components/ImageLightbox.tsx`, `ImageLightbox.test.tsx`.

**Interfaces:** `ImageLightbox` — `{ src: string; alt: string; onClose: () => void }`. Renders a fixed, semi-transparent (`bg-black/80`, NOT fully opaque) backdrop with a centered `<img className="max-h-[90vh] max-w-[90vw] object-contain">` (fit, never upscale beyond native via `object-contain` + max bounds), a top-right close `<button aria-label={t('chat.closeLightbox')}>`. `role="dialog" aria-modal="true"`. On mount, focus the close button; `Esc` and backdrop click call `onClose`; clicks on the image don't. No download control.

- [ ] **Step 1: Tests (red)**:

```ts
it('shows the image and closes on Esc, backdrop, and the close button', async () => {
  const onClose = vi.fn();
  render(<ImageLightbox src="/attachments/r1/f0/c.png?token=m1" alt="c.png" onClose={onClose} />);
  expect(screen.getByRole('img', { name: 'c.png' })).toHaveAttribute('src', expect.stringContaining('?token=m1'));
  fireEvent.keyDown(window, { key: 'Escape' }); expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /close/i })); expect(onClose).toHaveBeenCalledTimes(2);
});
it('does not close when the image itself is clicked', () => {
  const onClose = vi.fn();
  render(<ImageLightbox src="x" alt="c" onClose={onClose} />);
  fireEvent.click(screen.getByRole('img')); expect(onClose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — `useEffect` for the `Escape` keydown listener (cleanup on unmount) + focus the close button via a ref; backdrop `onClick={onClose}`, image wrapper `onClick={(e) => e.stopPropagation()}`. **Step 4: Run** `npx vitest run src/features/chat/components/ImageLightbox.test.tsx` → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): image lightbox overlay (view-only, esc/backdrop close)"`.

---

### Task 19: Wire the lightbox + frontend gate + smoke

**Files:** Modify `frontend/src/features/chat/ChatPanel.tsx`; export lightbox from the feature if needed.

**Interfaces:** `ChatPanel` owns `const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)`, passes `onOpenImage={(src, alt) => setLightbox({ src, alt })}` down through the message list to `ChatMessageItem`, and renders `{lightbox && <ImageLightbox {...lightbox} onClose={() => setLightbox(null)} />}`. On close, focus returns to the originating thumbnail (store the trigger element ref, or rely on the browser default + a follow-up).

- [ ] **Step 1: Test (red)** — render `ChatPanel` with a message containing an image attachment (seed the store + memberToken), click the thumbnail, assert the lightbox `dialog` appears; click close, assert it's gone. Mock `useChat`/socket as the existing ChatPanel test does.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the state + prop threading. **Step 4: Frontend gate** — `cd frontend && npm run typecheck && npm run lint && npm test` → clean/PASS.
- [ ] **Step 5: Manual Docker smoke** — `docker compose up --build`, two browsers in a room:
  1. Paperclip → pick a PNG + a PDF → both stage above the input with remove ×; Send with empty text works.
  2. The other participant sees the image as a thumbnail and the PDF as a chip (name + size + download).
  3. Click the thumbnail → full-size overlay (dimmed, not black; fits viewport; not upscaled); close via ×, Esc, and backdrop.
  4. Click the PDF chip's download → browser downloads the file.
  5. Try a `.exe` → `Unsupported file type.`; an 11 MB file → `File exceeds 10 MB.`; a 6th file → `You can attach up to 5 files per message.` (none staged).
  6. Kill the backend mid-send → message shows `Not delivered`; text + staged files retained for resend.
  7. End/destroy the room → confirm the room's upload folder is deleted (or removed on next backend restart via the sweep).
- [ ] **Step 6:** Commit any smoke fixes, then follow `superpowers:finishing-a-development-branch`.

---

## Self-Review

**Spec coverage (M5):**
- FR-26 (attach + stage + type/size/count validation + inline errors) → Tasks 14 (client validation), 16 (paperclip/staging/errors), 4/7 (server validation). Verbatim errors → Task 10.
- FR-27 (thumbnails, file chips, lightbox, view-only, focus, dim-not-black) → Tasks 17 (render), 18 (lightbox), 19 (wire).
- FR-24 (send enabled with text OR ≥1 attachment; Sending…/retain on fail) → Tasks 5/6 (server empty rule), 13/15/16 (canSend + resend-retain).
- FR-23 (history includes attachments) → Tasks 5 (`ChatMessage.attachments` in history/build), 13/17 (render delivered).
- Validation table row 3 (≤10 MB, ≤5, exact types, both sides) → Tasks 4 (server), 14 (client).
- Storage/auth/cleanup (§3.5, NFR-10) → Tasks 1/2 (memberToken), 7 (upload auth), 8 (download auth), 4/9 (disk layout, deleteRoomFolder, startup sweep).

**Type consistency:** `Attachment`/`AttachmentKind` identical backend (`attachments.ts`, Task 4) ↔ chat (`chat.ts`, Task 5) ↔ FE types (Task 11) ↔ socket payloads (Tasks 6/11). `memberToken` flows registry (1) → join response (2) → `JoinResponse` + `joinResponseSchema` (11) → `LocalParticipant` (12) → upload/download/render (7/8/17). `send_message` payload `{ text, attachments? }` mirrored FE↔BE (6/11). Error codes `UNSUPPORTED_TYPE`/`FILE_TOO_LARGE`/`FORBIDDEN` backend (3) ↔ `UploadResult` FE (11).

**Placeholder scan:** every task carries concrete code/tests + commands. Inline SDK/lib-verify points: multer's file-size-limit error → 413 mapping (Task 7, verify multer's `LIMIT_FILE_SIZE` error surface); the `uploadAttachment` error-body cast (Task 11, low-stakes per the post-MR3 convention).

**Deferred follow-ups (flag to the executor/user):**
- **D7 is built, not deferred** — GIF/WebP render as a canvas-frozen still in the list and animate only in the lightbox (Task 17). Note: canvas first-frame capture relies on the offscreen `Image` having loaded a decodable first frame; if a specific codec fails to draw, the thumbnail falls back to a blank canvas box — acceptable for scope.
- **D2 resolved** — memberToken is a per-room `Set<string>` issued at `/join`; sufficient for M5 auth. A richer per-participant registry (identity mapping) is a later concern only if M6 needs it.
- Lightbox focus-return to the exact trigger element is best-effort (Task 19) — a stored trigger ref can be added if QA finds focus drifts.
- **No explicit "resend" button** — a failed message shows `Not delivered` with its text + staged files retained visually, matching the existing text-chat behavior (no resend UI exists today). Adding a resend affordance is out of M5 scope.
- Upload folder cleanup hooks into M4's teardown (present on this branch, Task 9); the startup sweep remains the backstop for crash-orphaned folders.

---

**Decisions locked (brainstorm 2026-07-01 — no open confirms remain):**
1. **memberToken at `/join`** (D2), stored as a per-room `Set<string>`.
2. **Animated thumbnails: client-side canvas still-frame** (D7) — GIF/WebP are still in the list, animate only in the lightbox.
3. **multer** for multipart (D3).
4. **Upload-on-send** (D12) — files staged locally + validated on pick, uploaded only on Send.
5. **M4 is present on this branch** — build directly on the current tree; hook cleanup into M4's teardown (see "Coordination with M4").

Aligned with the design spec: `docs/superpowers/specs/2026-07-01-m5-chat-attachments-design.md`.
