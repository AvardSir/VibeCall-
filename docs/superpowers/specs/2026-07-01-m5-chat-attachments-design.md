# M5 — Chat Attachments + Image Lightbox — Design

- **Version:** 1.0
- **Date:** 2026-07-01
- **Status:** Approved for planning
- **Milestone:** M5 of `docs/superpowers/plans/2026-06-30-prd-gap-roadmap.md`
- **Parent spec:** `docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md` §3.4, **§3.5**
- **Product source (binding):** `prd-kmb-video-chat.md` (v2.0) — FR-26, FR-27, US-10,
  §6 validation-table row 3 (chat attachment). "FR-N"/"US-N" point at the PRD; "master §X" at the
  technical design.
- **Depends on:** existing chat only (Subtask 2 / `02-text-chat.md`). Independent of M2–M4.
- **Nature:** A forward-compatible extension of the existing text chat. It **adds** attachments to
  the already-shipped `send_message`/`ChatMessage` flow without changing text behavior.

---

## 1. Goal

Reach this product state (US-10):

- A participant can attach **images and files** to a chat message via a paperclip control, staging
  up to **5** files per message, each validated for type and size before it is accepted.
- Sent **image** attachments (PNG, JPEG, GIF, WebP) render as **thumbnails**; clicking one opens a
  full-size, view-only **lightbox** overlay. Animated GIF/WebP are **still** in the list and animate
  **only** in the overlay.
- Sent **non-image** files (PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP) render as a **chip** (name, size,
  download); clicking the download control downloads via the browser.
- Every participant receives the same attachments. A message carrying attachments shows `Sending…`
  until delivered, or `Not delivered` on failure (text + staged files retained for resend).
- Attachments are ephemeral: discarded when the room is destroyed (FR-23 lifecycle).

## 2. Locked decisions (from brainstorming, 2026-07-01)

1. **Upload-on-send.** Files are staged locally and validated (type/size/count) when picked; the
   bytes upload only on **Send**. The optimistic message shows `Sending…` during upload. Retry
   re-uploads; nothing is uploaded if the user never sends.
2. **Client-side canvas freeze for animated stills.** For GIF/WebP the list thumbnail is the first
   frame drawn to a `<canvas>`; the lightbox uses a normal `<img>` that animates. No server-side
   image library (avoids the `sharp`/musl risk noted in `CLAUDE.md`).
3. **`memberToken` at `/join`** (master §3.5). An opaque per-participant token issued from
   `POST /rooms/:roomId/join` gates upload (header) and download (query). It is separate from the
   broadcast `senderIdentity`.

## 3. Scope boundary

### In scope
- Backend: `memberToken` issuance/verification; attachment upload + download REST endpoints;
  disk storage (room-scoped) + validation; `send_message`/`ChatMessage` extended with attachments;
  room-end + startup cleanup.
- Frontend: paperclip + staging UI with inline validation errors; upload-on-send wiring; image
  thumbnails (with animated-still freeze), file chips, image lightbox; `memberToken` threaded from
  join into uploads/downloads; EN/RU strings.

### Out of scope (unchanged / other milestones)
- Text-chat behavior, unread badge, history-on-join, `Sending…`/`Not delivered` mechanics — already
  shipped; attachments reuse them.
- Screen share (M6), host lifecycle/grace (M4), theme/language (M1), video grid (M2).
- Server-side malware scanning (PRD out-of-scope §; R6). Type + size validation only.
- Thumbnail/animated-still generation on the server (decision 2 keeps this on the client).

## 4. Backend

Per `.claude/rules/50-backend.md` (flat `src/*.ts` modules, DI, logger, server-authority,
guard every socket listener).

### 4.1 Modules

| Module | Change |
| --- | --- |
| `config.ts` | Add `attachmentsDir` (env `ATTACHMENTS_DIR`, sensible default under the repo/data dir). Validate at startup. |
| `rooms.ts` | `Room` gains `memberTokens: Set<string>`. Registry adds `issueMemberToken(roomId): string` (≥128-bit, `randomBytes(16).base64url` like the existing token helper) and `verifyMemberToken(roomId, token): boolean`. Tokens are dropped in `markEnded`. |
| `attachments.ts` **(new)** | Owns the allowed-type table, limits, validation, disk storage, download path resolution (traversal-guarded), and cleanup. Owns the `Attachment` type. |
| `routes/rooms` (+ a small `attachments` route) | `POST /rooms/:roomId/attachments`; `GET /attachments/:roomId/:fileId/:name`. |
| `chat.ts` | `ChatMessage.text?` + `attachments: Attachment[]`; message validation accepts attachments. Owns `Attachment` type re-export or imports from `attachments.ts` (single owner — `attachments.ts`). |
| `socket.ts` | `send_message` payload gains `attachments`; server re-validates and relays them. |
| `server.ts` | Startup orphan sweep; construct `attachments` service and inject it. |

### 4.2 `Attachment` type (master §3.5 — single owner: `attachments.ts`)

```ts
type AttachmentKind = 'image' | 'file';

type Attachment = {
  fileId: string;   // server-generated id
  name: string;     // original (sanitized) file name
  size: number;     // bytes, <= 10 MB
  mime: string;
  kind: AttachmentKind; // 'image' => thumbnail + lightbox; 'file' => download chip
  url: string;      // tokenless download PATH, e.g. /attachments/:roomId/:fileId/:name
};
```

Stored `url` is **tokenless**; each client appends its own `?token=<memberToken>` when fetching
(so an `<img src>` / `<a download href>` can carry it). Storage layout:
`<attachmentsDir>/<roomId>/<fileId>__<sanitized-name>`.

### 4.3 Allowed types & limits (validation-table row 3)

- **Images:** PNG, JPEG, GIF, WebP → `kind: 'image'`.
- **Files:** PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP → `kind: 'file'`.
- **≤ 10 MB** per file (`MAX_FILE_SIZE = 10 * 1024 * 1024`).
- **≤ 5** attachments per message (`MAX_FILES_PER_MESSAGE = 5`).
- Type classified by **extension + MIME**. Client MIME is spoofable (master §8, documented
  limitation — accepted for this member-gated, ephemeral scope).

### 4.4 Endpoints

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `POST /rooms/:roomId/attachments` | `x-member-token` header, verified against the room | Multipart single file field `file` (`multer` memoryStorage). Validate type/size → on failure return the mapped error code (`UNSUPPORTED_TYPE` → "Unsupported file type.", `TOO_LARGE` → "File exceeds 10 MB."). On success store on disk, return the `Attachment` metadata. |
| `GET /attachments/:roomId/:fileId/:name` | `?token=` member token, verified against the room | Non-members → `403 FORBIDDEN`. **Images: served inline** with the correct `Content-Type` (so `<img>` renders). **Files: `Content-Disposition: attachment; filename="<name>"`** (so a cross-origin `<a download>` actually downloads). Path is traversal-guarded (resolve within the room folder; `fileId`+`name` must match a stored entry). |

**Dependency:** add `multer` (pinned exact, no `^`/`~`; 2.x for Express 5), memoryStorage — we
validate then write via `attachments.store` ourselves.

### 4.5 Join contract change

`POST /rooms/:roomId/join` additionally issues a `memberToken` and returns it in the JSON body
(alongside `accessToken/livekitUrl/role/identity/displayName/roomId`). This extends Subtask 1's
contract; the join zod schema and `JoinResult` on the frontend gain `memberToken`.

### 4.6 `send_message` / relay changes

- Payload: `{ text?: string; attachments?: Attachment[] }`.
- Validation (server-authoritative): **empty only if no text AND no attachments** (`EMPTY_MESSAGE`);
  `text.length > 1000` → `TEXT_TOO_LONG`; `attachments.length > 5` → `TOO_MANY_ATTACHMENTS`; each
  attachment must be well-shaped **and its file must exist** in the room folder → else
  `INVALID_ATTACHMENT`. Sender identity/name still stamped from the socket binding, never the payload.
- `ChatMessage` broadcast to the room now carries `attachments`.
- New `ChatErrorCode`s: `TOO_MANY_ATTACHMENTS`, `INVALID_ATTACHMENT` (added to both the backend map
  and the duplicated frontend `socketEvents.ts`, kept in sync per the cross-ref convention).

### 4.7 Cleanup

- **Room end:** on the teardown paths (`controller.end` and grace-expiry in `grace.ts`), call
  `attachments.deleteRoomFolder(roomId)`. Fold in the **currently-missing `chat.clear(roomId)`** at
  the same sites (today `chat.clear` is defined but never invoked), so chat + attachments are
  discarded together (FR-23).
- **Startup sweep:** `attachments.sweepOrphans(validRoomIds)` in `server.ts` removes room folders
  with no live registry entry (crash-orphaned), bounding disk use across restarts (master §3.5, §8).

## 5. Frontend

Per `.claude/rules/20-frontend-structure.md` (feature-based, presentational components, logic in
hooks/stores) and `40-styling-and-i18n.md` (Tailwind `dark:`, all strings via `t()`).

### 5.1 Types, API client, stores

- `shared/types`: add `Attachment` + `AttachmentKind`; `ChatMessage.attachments: Attachment[]`,
  `text?: string`.
- `shared/lib/apiClient.ts`: `joinRoom` result + `joinResponseSchema` gain `memberToken`;
  `uploadAttachment(roomId, memberToken, file): Promise<Attachment>` (multipart POST);
  `attachmentUrl(roomId, attachment, memberToken): string` (full URL + `?token=`).
- `useConnectionStore.localParticipant` gains `memberToken` (connection-scoped member secret).
- `useChatStore.ChatItem` gains `attachments: Attachment[]`; `addOptimistic` carries the staged
  attachments (local-preview form) and delivered echo replaces them with server metadata.

### 5.2 Hook

- `useChat.sendMessage(text, files)`: add optimistic item (`Sending…`, local previews) → upload all
  files (`Promise.all(uploadAttachment)`) using `memberToken` → emit `send_message { text,
  attachments }`. On any upload rejection → `markFailed` (text + files retained). `message_failed`
  still flips to `Not delivered`.

### 5.3 Components

- **`ChatInput`**: paperclip button + hidden `<input type="file" multiple accept=…>`. Staged files
  held locally; each pick validated (extension+MIME, ≤10 MB, running count ≤5) with the inline
  errors below the input (verbatim, §6). Staged **chips** (filename + `×` remove) above the input.
  **Send enabled when text is non-empty OR ≥1 file staged.** On submit: pass text + files, clear both.
- **`AttachmentThumbnail`**: image thumbnail. For animated types (GIF/WebP) draw the first frame to
  a `<canvas>` for the still list view; click opens the lightbox. `alt` = file name.
- **`FileChip`**: file icon + name + human size + download control (`<a download href={url+token}>`).
- **`ImageLightbox`**: React portal. **DEVIATION (2026-07-02, intentional):** the backdrop is
  **opaque (`bg-black`)**, not the semi-transparent "call runs behind it" backdrop originally
  specified here — an opaque backdrop was adopted deliberately to fix a **zoom-dim flicker** during
  open, and is kept on purpose (code and spec reconciled here). Centered `<img>` `object-contain`,
  scaled to fit viewport, **never enlarged beyond native size**. Close via `×` button, `Esc`, or
  backdrop click. **View-only** (no download inside).
  Animated images animate here. Accessibility: focus moves into the overlay on open and returns to
  the originating thumbnail on close; close button has an accessible label.
- **`ChatMessageItem`**: below the text, render an attachments block — images via
  `AttachmentThumbnail`, files via `FileChip`.

## 6. Strings (verbatim — PRD §6 / FR-26 / US-10; namespace `chat`, EN + RU parity)

- `"Unsupported file type."`
- `"File exceeds 10 MB."`
- `"You can attach up to 5 files per message."`
- Reused (already present): `"Sending…"`, `"Not delivered"`.
- New aria/tooltip labels (author EN+RU; wording not fixed by the PRD, keep consistent): attach,
  remove attachment, download file, close image viewer.

All via `t()`; no hardcoded user-facing strings. Human-readable file size is formatted client-side.

## 7. Validation rules (validation-table row 3)

- Per file: allowed type (else "Unsupported file type.", not staged); ≤ 10 MB (else "File exceeds
  10 MB.", not staged). Over 5 per message: the extra is not staged ("You can attach up to 5 files
  per message.").
- Enforced **client-side** for UX (staging) **and server-side** (upload endpoint + `send_message`
  relay). Server is authoritative.

## 8. Testing (co-located, behavior-first — `.claude/rules/60-testing.md`)

**Backend**
- `attachments.ts`: accept each allowed type, reject unsupported (`UNSUPPORTED_TYPE`) and >10 MB
  (`TOO_LARGE`); store writes to `<dir>/<roomId>/<fileId>__<name>`; path-resolution rejects
  traversal (`../`, mismatched name/fileId).
- `rooms.ts`: `issueMemberToken` unique + `verifyMemberToken` true/false; dropped on `markEnded`.
- Upload route: member gate (`403` without/with bad token), type/size validation, success returns
  metadata + file on disk.
- Download route: member gate (`403` for non-member), images inline vs files `attachment`
  disposition, traversal guard.
- `send_message` relay: >5 → `TOO_MANY_ATTACHMENTS`; text-empty + ≥1 attachment allowed;
  missing/ill-shaped attachment → `INVALID_ATTACHMENT`; sender stamped from binding.
- Cleanup: room-end deletes the folder + clears chat; startup sweep removes orphaned folders.

**Frontend**
- `ChatInput`: staging validation + each inline error; count cap at 5; Send enabled on text-only,
  attachment-only, and both; disabled when empty.
- `useChatStore`: optimistic item carries attachments → delivered echo replaces with server
  metadata; failure retains.
- `useChat`: upload-then-emit order; upload rejection → failed + retained.
- `ImageLightbox`: opens on thumbnail click; closes on `×`, `Esc`, backdrop; focus returns to the
  thumbnail; no download control present.
- `AttachmentThumbnail`: animated type renders the still (canvas) path.
- `FileChip`: download href carries the member token.

**Composition / smoke (rule 60 — mandatory before "done").** After green unit gates, run
`docker compose up --build` and manually: upload a real **image** and a real **PDF** from one
participant; confirm the thumbnail + lightbox (Esc/backdrop close, no download inside), the file
chip download, and that a **second participant** receives both. Green typecheck/lint/tests is not
"it works".

## 9. Forward-compatibility / notes

- `send_message { text }` → `send_message { text?, attachments }`; `ChatMessage` gains
  `attachments` — additive, no break to existing text messages or history.
- Membership for attachments is backed by the `memberToken` (master §3.5), complementing the
  socket's `join_chat` binding used for chat relay.
- Client-supplied MIME is trusted for classification (master §8) — acceptable for the member-gated,
  ephemeral scope; server-side scanning remains out of scope (R6).
