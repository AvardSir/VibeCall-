# КМБ Video Chat — Technical Implementation Spec

- **Version:** 1.0
- **Date:** 2026-06-26
- **Status:** Approved for planning
- **Source of truth:** `prd-kmb-video-chat.md` (v2.0) and `KMB_VideoChat_Wireframes_with_Overview.html` (v1.0, 16 screens)
- **Scope:** Desktop only (≥1024px). Group video calls, up to 4 participants, no sign-up.

---

## 1. Overview

КМБ Video Chat is a no-sign-up group video calling web app for up to 4 participants per
room. One person is the **host** (creates the room, owns it) and the others are **guests**
(join via a shared participant link). The app supports camera/mic, screen sharing (one at a
time), text chat with image/file attachments, dark/light theming, and EN/RU localization.

This document specifies the **technical implementation**: architecture, components,
interfaces, data models, and behaviors needed to build the 16 screens and states defined in
the wireframes.

### 1.1 Technology decisions

| Concern | Decision |
| --- | --- |
| Media transport | Self-hosted **LiveKit** server (SFU). Local deployment. |
| Frontend | **React + TypeScript + Vite**, LiveKit Components React SDK, Tailwind CSS, react-i18next |
| Backend | Single **Node + TypeScript** service (control plane) |
| Realtime chat / presence | **Socket.IO** (backend-owned) |
| Token generation | LiveKit server SDK `AccessToken` helper (no hand-rolled JWT) |
| Attachment storage | Local disk on the backend, room-scoped folders |
| Room state | In-memory registry on the backend (authoritative) |

### 1.2 Non-goals

- Mobile / responsive layouts below 1024px.
- Recording, transcription, or persistence of calls or chat beyond a room's lifetime.
- More than 4 participants per room; waiting rooms; user accounts.
- System / tab audio capture during screen share (out of scope per PRD).

---

## 2. System architecture

Three cooperating processes:

```
┌─────────────┐   REST: rooms, tokens, host actions     ┌──────────────────┐
│   Frontend  │ ──────────────────────────────────────▶ │  Node/TS backend │
│ React+Vite  │   Socket.IO: chat, presence, grace      │  (control plane) │
│ LiveKit SDK │ ◀══════════════════════════════════════▶ │                  │
└─────┬───────┘                                           └────────┬─────────┘
      │  WebRTC media + screen share (SFU)                         │ Server API
      ▼                                                   webhooks │ + tokens
┌───────────────────────────────────────────────────────────────┐ │
│                  Local LiveKit server (SFU)                     │◀┘
└─────────────────────────────────────────────────────────────────┘
```

- **Frontend** renders all 16 screens, connects to LiveKit with a backend-issued token,
  renders the adaptive video grid, and runs chat over a Socket.IO connection to the backend.
- **Backend** is the authority for room lifecycle, host/guest roles, the host-reconnect
  grace timer, chat relay + history, and attachment storage. Media never passes through it.
- **LiveKit** carries all media (camera, microphone, and screen share as a second track).

### 2.1 Trust & roles

- A **host** is identified by a host token issued only to the room creator. Host tokens carry
  LiveKit `roomAdmin` grants; the backend also records the host's participant identity in the
  room registry. Only the host can remove guests, end the call, and see "Copy link".
- **Host token is never placed in the URL.** `POST /rooms` returns the `hostToken` in the response
  body; the host client stores it in `sessionStorage` and navigates to the **clean** `/r/:room`
  (no `?host=` query). The app reads the token from `sessionStorage` to authenticate host actions,
  so it survives a page reload but is **not** exposed in the address bar (which a participant can
  reveal while screen sharing) or in browser history. The wireframe's `?host=••••` is illustrative;
  no PRD functional requirement mandates the URL placement. Guests open the tokenless `/r/:room`.
- A **guest** receives a standard publish/subscribe token. Guests cannot perform host actions;
  the backend rejects any host action whose caller identity is not the recorded host.
- **Participant identity** equals the participant's display name, which must be **unique within a
  room** (case-insensitive). A second person attempting an already-used name is rejected with
  `NAME_TAKEN`, so identities never collide. Host actions (e.g. remove) target a participant by
  this identity, which the frontend reads from the join response and from LiveKit participant
  objects. The host is authenticated by the host token (not by name), so on reconnect the host
  re-takes its own slot even while that name is momentarily reserved during grace.
- Each participant also receives an opaque **`memberToken`** at `/join`, recorded in the room
  registry. It proves room membership for attachment upload/download (see §3.5) — uploads to a room
  and downloads from it are rejected without a valid member token.
- All authority is enforced **server-side**. The frontend hides host-only controls for guests,
  but the backend is the source of truth and re-validates every host action.

---

## 3. Backend service

A single Node + TypeScript service. Suggested internal modules:

| Module | Responsibility |
| --- | --- |
| `tokens` | Generate LiveKit access tokens via `AccessToken` (room name, identity, grants) |
| `rooms` | In-memory room registry: lifecycle, participant tracking, 4-person cap, host identity |
| `hostActions` | `removeGuest`, `endCall` via LiveKit `RoomServiceClient` |
| `grace` | Host-reconnect 60s countdown, driven by LiveKit webhooks + timers |
| `chat` | Socket.IO chat relay + per-room in-memory history (unread badge is client-derived — see §3.4) |
| `attachments` | Upload validation + local disk storage + download serving + cleanup |
| `webhooks` | LiveKit webhook receiver (participant joined/left, room finished); **verifies the webhook signature** via the LiveKit SDK `WebhookReceiver` before acting (see §3.3) |

### 3.1 Room registry (in-memory)

```ts
type RoomState = {
  roomName: string;              // LiveKit room name, e.g. "r_3f9a..."
  hostIdentity: string;          // participant identity of the host
  hostToken: string;             // opaque secret returned to the host client (stored client-side in sessionStorage)
  status: 'active' | 'grace' | 'ending' | 'ended';  // 'ending' set before deleteRoom on intentional End call (see §3.3)
  participants: Map<string, Participant>; // identity -> participant
  createdAt: number;
  graceTimer?: NodeJS.Timeout;   // active only during host-reconnect grace
  graceEndsAt?: number;
  chatHistory: ChatMessage[];    // cleared when room ends
  activeSharerId: string | null; // identity of the current screen sharer, or null (see §3.6)
};

type Participant = {
  identity: string;
  displayName: string;
  role: 'host' | 'guest';
  joinedAt: number;
  memberToken: string;       // opaque per-participant secret; proves room membership for attachments
};
```

Rooms are created on host "Start a call", and removed from the registry when the room ends
(host ends call, or host grace expires). Capacity is **4 total** including the host.

### 3.2 REST API

| Method & path | Auth | Purpose | Returns |
| --- | --- | --- | --- |
| `POST /rooms` | none (per-IP rate-limited) | Host starts a call. Create LiveKit room + registry entry. `hostToken` is returned in the body for the client to store in `sessionStorage` (not embedded in any URL); `participantUrl` is the tokenless guest link. | `{ roomName, hostToken, participantUrl }` |
| `GET /rooms/:roomName` | none | Validate a link before pre-join. | `{ status }` → drives S1/S2/S3 |
| `POST /rooms/:roomName/join` | name + optional hostToken | Issue a LiveKit token for host or guest; re-check capacity/status. | `{ accessToken, livekitUrl, role, identity, memberToken }` or error code |
| `POST /rooms/:roomName/remove` | hostToken + targetIdentity | Remove a guest (LiveKit `removeParticipant`). | `200` / error |
| `POST /rooms/:roomName/end` | hostToken | End the call for everyone (LiveKit `deleteRoom`). | `200` |
| `POST /rooms/:roomName/attachments` | memberToken (`x-member-token` header) | Upload 1 file; validate type/size; store on disk. | `{ fileId, name, size, mime, url, kind }` |
| `GET /attachments/:roomName/:fileId/:name` | memberToken (`?token=` query) | Download / serve an attachment. | file bytes |

**Join validation outcomes** (map to system screens):
- Room not in registry / bad format / invalid host token → `NOT_FOUND` → **S3**.
- Room `status === 'ended'` → `ENDED` → **S2**.
- Room at 4 participants → `FULL` → **S1**.
- Display name already in use in this room (case-insensitive) → `NAME_TAKEN` → inline error on the
  pre-join screen; the user re-enters a different name. (Host reconnect is exempt — see §2.1.)
- Otherwise → issue token, role = `host` if valid hostToken else `guest`.

### 3.3 Host-reconnect grace (60s)

0. **Webhook authenticity.** Every LiveKit webhook is verified with the SDK `WebhookReceiver`
   (signature against the LiveKit API key/secret) before the backend acts on it. Unverified
   payloads are rejected — otherwise anyone could POST a forged `room_finished`/`participant_left`
   to end or destabilize a call.
1. LiveKit fires `participant_left` webhook. Backend checks if the leaver is the host.
2. If host left **unexpectedly** (not via `endCall`): set room `status = 'grace'`, record
   `graceEndsAt = now + 60s`, start a 1s broadcast over Socket.IO of remaining seconds.
   "Unexpected" is determined by the intentional-end flag: `endCall` sets `status = 'ending'`
   **before** calling `deleteRoom`, so the resulting host `participant_left` is recognized as a
   normal teardown and does **not** trigger grace. A host `participant_left` while `status ===
   'active'` is the unexpected case that starts the countdown.
3. Guests render the **G6** overlay with the live countdown.
4. If the host reconnects within 60s (re-join with hostToken): cancel timer, `status = 'active'`,
   broadcast `grace_cancelled`, guests clear the overlay.
5. If 60s elapse: call `endCall` logic → room ends → guests routed to the "host disconnected"
   end state (S2 on subsequent visits).

Guests have **no grace period** — an unexpected guest disconnect is treated as leaving and the
slot is freed (G2 behavior).

**Presence authority.** LiveKit webhooks are authoritative for who is actually in the room. On
`participant_left` the backend frees that participant's slot in the registry, so capacity always
reflects reality. The one exception is the host during grace: when the host leaves an **active**
room the backend keeps the host's slot **reserved** (does not remove them) for the 60s window, so
a fourth guest cannot take the host's place before they reconnect. When grace expires the room
ends and all slots are cleared; when the host returns, their reserved slot becomes active again.

### 3.4 Chat (Socket.IO)

Backend owns chat fully. Per-room namespace/room keyed by `roomName`.

**Server → client events:** `chat_history` (on join), `chat_message`, `message_failed`
(`{ code }`, to the sender only), `grace_tick`, `grace_cancelled`, `room_ended`,
`share_granted`, `share_denied`, `share_state` (see §3.6).

**Client → server events:** `send_message` (text + attachment metadata),
`join_chat` (identity, role), `claim_share`, `release_share` (see §3.6).

> **Client-derived UI state (no server events).** The unread badge, the `Sending…`/delivered
> message status, and the participant roster are computed on the client — not pushed by the
> backend. The unread count comes from `chat_message` arriving while the panel is closed (reset on
> open); `Sending…` is the optimistic local state shown until the server echoes the message back
> via `chat_message` (failure arrives as `message_failed`); the roster is derived from LiveKit
> participant events (§4.3). This keeps per-client UI state on the client (see rule
> `30-state-store.md`) and the server authoritative only for relay, history, and lifecycle.

```ts
type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string;
  senderName: string;
  sentAt: number;            // epoch ms; rendered as HH:MM
  text?: string;             // max 1000 chars
  attachments: Attachment[]; // up to 5
};

type Attachment = {
  fileId: string;
  name: string;
  size: number;              // bytes, <= 10MB
  mime: string;
  kind: 'image' | 'file';    // image => lightbox; file => download chip
  url: string;               // backend download URL
};
```

Chat rules (from PRD/wireframes):
- History accrued while the room is alive; new joiners receive `chat_history`. Cleared on room end.
- Send enabled when there is text **or** ≥1 attachment. Max 1000 chars; counter appears at 900.
- Hidden panel + new message → unread dot on chat button; cleared on open.
- In-flight message shows `Sending…`; on failure `Not delivered`, text + attachments retained for resend.
- Empty state: `No messages yet.`

### 3.5 Attachments (local disk)

- **Allowed types:** images `PNG/JPEG/GIF/WebP`; files `PDF/DOC/DOCX/XLS/XLSX/TXT/ZIP`.
- **Limits:** ≤10 MB per file; ≤5 files per message.
- **Storage layout:** `<storage-root>/<roomName>/<fileId>__<sanitized-name>`.
- **Serving:** images → thumbnail in chat, click opens full-size lightbox overlay (view only,
  no download in overlay; animated GIF/WebP animate only in the overlay). Files → chip with
  name + size + download; click downloads via browser, no in-app preview.
- **Access:** both endpoints require the caller's `memberToken` (issued at `/join`) — the
  `x-member-token` header on upload, the `?token=` query param on download (so a native `<img>` or
  `<a download>` can carry it). Non-members get `403 FORBIDDEN`. Stored URLs are tokenless; each
  client appends its own token when fetching.
- **Cleanup:** the room folder is deleted when the room ends. On backend **startup**, a one-time
  sweep of `<storage-root>` removes any room folder that has no matching entry in the (freshly
  empty) registry — i.e. folders orphaned by a previous crash — so disk usage cannot grow
  unbounded across restarts.
- **Errors:** `Unsupported file type.` / `File exceeds 10 MB.` / `You can attach up to 5 files per message.`

### 3.6 Screen-share arbitration

LiveKit does not enforce a single screen-share, so the backend arbitrates the "one share at a
time" rule (spec §4.4) over Socket.IO. Each room holds `activeSharerId: string | null`.

- **`claim_share` `{ roomName }`** — client requests to start sharing. Server:
  - if no active share (or the caller already holds it) → set `activeSharerId = caller`, reply
    `share_granted` to the caller, broadcast `share_state { activeSharerId }` to the room;
  - if someone else is sharing → reply `share_denied { reason: 'busy' }` (→ UI string
    `Someone is already sharing their screen`).
- **`release_share` `{ roomName }`** — client stops sharing. If the caller is the active sharer,
  clear `activeSharerId` and broadcast `share_state { activeSharerId: null }`.
- **`share_state { activeSharerId }`** — authoritative broadcast; clients enable/disable the
  "Share screen" button and pick the layout from it.

**Involuntary reset.** The share is also freed without a `release_share`:
- the sharer leaves or is removed → their LiveKit `participant_left` clears the share if they held
  it, then broadcasts `share_state { null }`;
- the host drops into grace → any active share is force-cleared (the G6 overlay replaces the view
  on clients), and the room end / host-timeout clears it as part of ending the room.

Only a participant of an `active` room can claim; claims against an ended room are rejected.

---

## 4. Frontend

React + TypeScript + Vite. LiveKit Components React SDK for media; custom layout components
for the bespoke grid, screen-share view, and overlays.

### 4.1 Cross-cutting

- **Theme:** Dark (default) / Light toggle, top-right on every screen. Tailwind `dark:` variants.
- **Language:** EN (default) / RU selector, top-right on every screen. react-i18next; all PRD
  strings (including the exact error/status messages) live in translation resources.
- **Desktop only:** target ≥1024px.

### 4.2 Routes / screens

| Screen | Route / state | Notes |
| --- | --- | --- |
| H1 Landing | `/` | "Start a call" → `POST /rooms` → store `hostToken` in `sessionStorage` → pre-join |
| H2 Pre-join (host) | `/r/:room` (pre-join; host via stored token) | Preview, cam/mic toggles, name, Enter call, Copy link |
| H3 In-call (host) | in-call state | Adaptive grid, controls + End call, Copy link, chat |
| H4 Chat panel | in-call sub-state | Same panel for both roles; slides in, video area shrinks |
| H5 Screen sharing | in-call sub-state | Shared content main area, tiles in strip |
| H6 Remove a guest | in-call dialog | Hover/focus "Remove" on guest tile → confirm dialog |
| G1 Pre-join (guest) | `/r/:room` (pre-join) | Button reads "Join"; no Copy link |
| G2 In-call (guest) | in-call state | Controls end with "Leave"; no Copy link / End / Remove |
| G3 Left the call | end state | "Rejoin" → pre-join for same room |
| G4 Removed by host | end state | "Back to home" |
| G5 Host ended call | end state | "Back to home" |
| G6 Host reconnecting | in-call overlay | 60s live countdown |
| S1 Call full | end state | "Back to home" |
| S2 Call ended | end state | "Start a new call" |
| S3 Not found | end state | "Start a new call" |
| S4 Unsupported browser | first-screen guard | Capability check on landing / pre-join |

### 4.3 Video grid

Adaptive layout by participant count: 1 (full + "Waiting for someone to join…"), 2 (left/right),
3 (two top + one centered bottom), 4 (2×2). Own tile is **mirrored** and labelled `<name> (You)`.
Camera-off tiles show an avatar; mic-off tiles show a mute icon. Built on LiveKit track
subscriptions; the grid CSS mirrors the wireframe layouts.

### 4.4 Screen share

- Any participant can share; **one active share at a time** (the backend arbitrates over
  Socket.IO — see §3.6: the first to `claim_share` wins, others get `share_denied { busy }` →
  `Someone is already sharing their screen`).
- While active: shared content fills the main area for **everyone including the sharer**
  (rendered `contain`, never cropped); all videos move to a thumbnail strip (rendered `cover`).
- Sharer keeps their camera on → two outgoing tracks (screen + camera); their camera tile
  stays in the strip.
- Main area label: `<name> is sharing their screen` (others) / `You are sharing your screen`
  (sharer). Sharer gets "Stop sharing"; everyone else's "Share screen" is disabled.
- Capture denied / cancelled → inline `Unable to share your screen. Please check your browser permissions.` (4s).
- Sharer leaves / removed / host grace begins → share ends, layout returns to grid.

### 4.5 Controls

- **Host:** Mic, Camera, Share screen, **End call** (red, ends room for all), plus Copy link and chat button.
- **Guest:** Mic, Camera, Share screen, **Leave** (no End call / Copy link / Remove).
- Mic/camera toggles flip to a struck-through "off" icon; device error shows inline above the bar, auto-dismiss 4s. A denied device disables its toggle for the whole session.

### 4.6 Transient states (additions, not among the 16 PRD screens)

These are not new screens — none of the 16 PRD screens is removed or altered. They are short-lived
states that necessarily occur at runtime and that the wireframes did not enumerate. Kept minimal
(a spinner + one line), with their strings entered into the i18n resources (§6) up front.

| State | When | Rendering |
| --- | --- | --- |
| **Connecting…** | After "Enter call" / "Join", while the LiveKit connection + token exchange complete, before the grid appears | Spinner over the pre-join card with `Connecting…`; on failure, the existing `Unable to connect to the call service…` (§6) |
| **Awaiting device permission** | On pre-join load, while the browser's camera/mic permission prompt is open | Preview area shows `Allow camera and microphone access to continue.`; resolves to the live preview (granted) or the existing per-device denied messages (§6) |
| **Reconnecting (self)** | The **local** participant's own connection drops and LiveKit is auto-reconnecting (distinct from G6, which is the *host* dropping) | Non-blocking overlay `Reconnecting…`; clears on resume, or routes to the call-service error if it cannot recover |

---

## 5. Key flows

1. **Host starts a call:** H1 → `POST /rooms` → `{ roomName, hostToken, participantUrl }` → store
   `hostToken` in `sessionStorage`, navigate to the clean `/r/:room` → H2 pre-join →
   `POST /rooms/:room/join` (hostToken from `sessionStorage`) → LiveKit token → connect → H3.
2. **Guest joins:** open link → `GET /rooms/:room` → if OK, G1 pre-join → `POST .../join` → token → G2.
   Blocked outcomes → S1 (full) / S2 (ended) / S3 (not found).
3. **Chat with file:** upload to `POST .../attachments` → backend stores on disk, returns metadata →
   client `send_message` over Socket.IO → backend relays + appends to history.
4. **Host removes guest:** hover guest tile → "Remove" → confirm dialog → `POST .../remove` →
   LiveKit `removeParticipant` → grid re-arranges; removed guest sees G4 (may rejoin).
5. **Host ends call:** `POST .../end` → set `status = 'ending'` → LiveKit `deleteRoom` → the host's
   own `participant_left` is recognized as intentional (no grace) → all disconnected → guests see
   G5; link now resolves to S2.
6. **Host drops:** webhook `participant_left` (host) → grace 60s → G6 countdown → reconnect resumes,
   else room ends.

---

## 6. Error & status messages (exact strings)

These must appear verbatim (localized EN/RU):

- Room creation failed: `Unable to start a call right now. Please try again.`
- Can't reach call service: `Unable to connect to the call service. Please check your internet connection and try again.`
- Camera denied: `Camera access was denied. You can enable it in your browser settings.`
- Mic denied: `Microphone access was denied. You can enable it in your browser settings.`
- Connecting (after Enter/Join): `Connecting…`  *(transient state — §4.6)*
- Awaiting device permission (pre-join): `Allow camera and microphone access to continue.`  *(transient state — §4.6)*
- Reconnecting (own connection dropped): `Reconnecting…`  *(transient state — §4.6; distinct from the G6 host-grace overlay)*
- Name empty: `Please enter your name`
- Name length: `Name must be 2–30 characters` (letters, numbers, spaces, hyphens, apostrophes only)
- Name already taken: `That name is already taken in this call.` *(new string — not in the original wireframes; confirm exact EN/RU wording with design before locking it in.)*
- Link copied: `Link copied!` (2s)
- Share denied: `Unable to share your screen. Please check your browser permissions.`
- Share busy: `Someone is already sharing their screen`
- Attachments: `Unsupported file type.` / `File exceeds 10 MB.` / `You can attach up to 5 files per message.`
- Chat empty: `No messages yet.`
- G4: `You were removed from the call by the host.`
- G5: `The host has ended the call.`
- G6 overlay: `The host lost connection. Waiting for them to return…` + `Reconnecting… <n>s`
- Host disconnect timeout: `The host has disconnected and the call has ended.`
- S1: `This call is full.` + `Only four participants can join at a time.`
- S2: `This call has ended.`
- S3: `This call was not found.` + `The link may be incorrect or expired.`
- S4: `Your browser may not support video calls.` + `Please use the latest version of Chrome, Firefox, Safari, or Edge.`

---

## 7. Validation rules

- **Name:** 2–30 characters; allowed: letters, numbers, spaces, hyphens, apostrophes.
- **Name uniqueness:** a display name must be unique within a room (case-insensitive); duplicates
  are rejected with `NAME_TAKEN`. The host is exempt on reconnect (authenticated by host token).
- **Capacity:** 4 participants total (host + 3 guests).
- **Chat text:** ≤1000 chars; counter at 900.
- **Attachments:** ≤10 MB/file, ≤5/message, allowed types per §3.5.
- **Host grace:** exactly 60 seconds.

---

## 8. Open implementation notes

- LiveKit is run locally; the backend needs its API key/secret and URL via environment config.
- Browser support check (S4) runs before the first interactive screen (landing or guest pre-join).
- Pre-join requests camera/mic permission on load; the user can enter even if a device is denied.
- Copy link: copies the participant URL; if clipboard is blocked, show the URL as selectable text.
- Participant links use `PUBLIC_BASE_URL` (falls back to `CORS_ORIGIN`) as their base, kept separate
  from the CORS allow-list so the two can differ in production.
- **In-memory state, by design.** The room registry, chat history, and grace timers live only in
  the backend process: a restart ends all active calls and clears chat/attachment state. This is
  acceptable for the ephemeral, no-sign-up scope; clients treat a dropped backend connection as the
  call ending. (A single process also means no horizontal scaling — out of scope.)
- **Idle-room reaping.** A timer (~every 60s) forgets rooms that can't be returned to: empty rooms
  never joined within ~10 min, and ended rooms after ~1 h (link revisits resolve to S2 until then).
  This bounds memory against repeated `POST /rooms` on the unauthenticated endpoint.
- **Webhook authenticity.** The LiveKit webhook endpoint verifies each request's signature with the
  SDK `WebhookReceiver` (keyed by the LiveKit API key/secret) and rejects anything unsigned/invalid,
  so room lifecycle and presence cannot be driven by forged payloads (see §3.3).
- **Rate-limiting `POST /rooms`.** The room-creation endpoint is unauthenticated, so it is per-IP
  rate-limited to bound abuse; the idle-room reaper bounds memory but not request rate.
- **Upload MIME is client-supplied.** Attachment type is classified from the request
  `Content-Type`, which a client can spoof. For this scope it is accepted (uploads are member-gated,
  room-scoped, and deleted on room end). Hardening if needed: verify file signatures (magic bytes)
  and/or cross-check the file extension against the allow-list.
