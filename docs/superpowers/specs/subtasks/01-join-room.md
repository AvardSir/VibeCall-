# Subtask 1 — User Can Join Room

- **Version:** 1.0
- **Date:** 2026-06-29
- **Status:** Approved for planning
- **Parent:** `docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md` (master spec)
- **Decomposition:** `docs/superpowers/specs/subtasks/00-overview.md`
- **Nature:** A **forward-compatible strict subset** of the master spec. It defers — never
  contradicts — the rest. Section references like "master §3.2" point at the master spec.

---

## 1. Goal

Reach this product state:

- The application has exactly **one** room.
- The room holds at most **4** participants.
- Opening the app page when the room already has 4 participants shows **"This call is full."**
- Otherwise the user enters the video-conference interface with their **own** camera/mic.

> The task description's shorthand "Room is full" is realized as the binding wireframe `S1` text:
> **"This call is full."** / **"Only four participants can join at a time."** / button
> **"Back to home"** (master §6, wireframe `wf-S1`).

## 2. Scope boundary

### In scope

- **One fixed room**, auto-provisioned by the backend (name from config). No room creation flow, no
  shareable links, no host/guest roles — every participant has `role: 'guest'`.
- **Pre-join screen:** mirrored local camera preview, camera/mic toggles (on by default), name
  input with validation, "Enter call". Device-permission handling.
- **Server-side capacity gate (4):** checked when the page loads and **re-checked** at join.
- **`S1` "call full" screen** with "Back to home".
- **In-call shell with the participant's own media:** connect to LiveKit, render the **own** tile
  (mirrored, labelled `<name> (You)`), controls bar (mic, camera, **Leave**).
- **i18n (EN/RU) infrastructure** with all strings via `t()`; **Dark** theme by default.

### Deferred (belongs to later subtasks / master spec — explicitly out)

| Deferred | Where it lands |
| --- | --- |
| Rendering **remote** participants' video + audio; the **2×2 grid** | Subtask 3 |
| Text chat, Socket.IO, attachments | Subtask 2 (chat), master §3.5 (attachments) |
| Room creation (`POST /rooms`), host token, shareable participant links | master §3.2, §2.1 |
| Host/guest roles, host actions (remove/end), `H3–H6`, `G3–G5` | master §2.1, §4.5 |
| 60s host-reconnect grace + `G6` overlay; LiveKit webhooks | master §3.3 |
| In-memory room **registry** as the capacity authority | master §3.1 (see §9 below) |
| Screen share + arbitration | master §3.6, §4.4 |
| `S2` (ended), `S3` (not found), `S4` (unsupported browser) screens | master §4.2 |
| Visible theme/language toggles | later (infra is in place now) |

## 3. The single-room model

- The backend serves exactly one room whose name comes from config: **`FIXED_ROOM_NAME`**
  (e.g. `"main"`). The frontend always targets this name; there is no link entry in this subtask.
- On startup the backend **ensures the room exists** in LiveKit
  (`RoomServiceClient.createRoom`, idempotent) with **`maxParticipants: 4`** set as a hard
  server-side backstop, plus a sane `emptyTimeout`.
- REST routes keep the master's `:roomName` shape for forward-compatibility, but in this subtask
  only `roomName === FIXED_ROOM_NAME` is valid; the frontend never sends anything else.

## 4. Backend

A subset of the modules in `.claude/rules/50-backend.md`. **No Socket.IO, no webhooks, no
attachments, no grace** in this subtask.

| Module | Responsibility in this subtask |
| --- | --- |
| `config.ts` | Env loading/validation; adds `FIXED_ROOM_NAME` to the master `AppConfig`. Fail fast on missing LiveKit key/secret/URL. |
| `logger.ts` | The single application logger (no raw `console.*`). |
| `validation.ts` | Display-name validation (length + allowed chars). |
| `livekitTokens.ts` | Mint a guest `AccessToken` (room join, `canPublish`, `canSubscribe`; **no** `roomAdmin`). |
| `livekitAdmin.ts` | `RoomServiceClient`: `ensureRoom()` at startup; `listParticipants(room)` for the live count. |
| `server.ts` | Composition root: wires modules, starts the HTTP server, exposes the two routes. |

### 4.1 Capacity mechanism (decided: count live LiveKit participants)

The live participant count comes from **LiveKit** (the source of truth for presence), not from an
in-memory registry:

- On `GET` and at `join`: `count = (await listParticipants(FIXED_ROOM_NAME)).length`.
  `count >= 4` ⇒ full.
- LiveKit's `maxParticipants: 4` on the room is the **hard backstop**: even if two clients pass the
  soft gate simultaneously, LiveKit rejects the 5th at connect time and the frontend maps that
  connect rejection to the "call full" state (§5, §6).

This keeps the subtask free of a registry and webhooks. The benign race (two clients clear the soft
gate at once) is bounded by the backstop and is acceptable for a 4-seat room; the master spec's
registry + webhooks (master §3.1, §3.3) tighten this when host/grace arrive — see §9.

### 4.2 REST API

| Method & path | Auth | Purpose | Returns |
| --- | --- | --- | --- |
| `GET /rooms/:roomName` | none | Capacity check before pre-join. | `{ status: 'available' \| 'full' }` |
| `POST /rooms/:roomName/join` | name in body | Re-check capacity + name uniqueness; mint a guest token. | `{ accessToken, livekitUrl, role: 'guest', identity }` or an error code |

- `GET` response `status` is the **capacity-relevant subset** of the master's availability check;
  `'available'` ⇒ pre-join, `'full'` ⇒ `S1`. (`'ended'`/`'not_found'` are added with later subtasks.)
- `join` response is a **subset** of master §3.2 (`memberToken` is omitted — it belongs to
  attachments, deferred). `identity === displayName` (master §2.1).

**`join` validation outcomes:**

| Condition | Error code | Frontend result |
| --- | --- | --- |
| Room at 4 participants | `FULL` | `S1` |
| Name empty / wrong length / illegal chars | `INVALID_NAME` | inline error on pre-join |
| Name already present in the room (case-insensitive vs `listParticipants` identities) | `NAME_TAKEN` | inline error on pre-join |
| Otherwise | — | issue guest token, connect |

- Validate the inbound payload at the boundary before acting. Return typed errors with a stable
  `code`; map to HTTP status + client error code at the edge (no internal message leakage).
- `POST /rooms` is unauthenticated in the master spec and per-IP rate-limited; this subtask exposes
  **no** room-creation endpoint, so that concern does not apply here.

## 5. Frontend

React + TS + Vite, feature-based (`.claude/rules/20-frontend-structure.md`). LiveKit Components
React SDK for media.

### 5.1 Screens

| Screen | Feature | Contents |
| --- | --- | --- |
| **Pre-join** | `features/prejoin` | Mirrored local camera **preview**; camera/mic **toggles** (on by default); **name** field with help text "2–30 characters. Letters, numbers, spaces, hyphens and apostrophes."; **"Enter call →"**. Device-permission handling (see §6). No "Copy link", no host controls. |
| **In-call shell** | `features/call` | Establishes the LiveKit room context and renders the participant's **own** tile (mirrored, `<name> (You)`); controls bar: mic toggle, camera toggle, **Leave**. The container is ready to host remote tiles + the 2×2 grid (Subtask 3) but renders none of them here. |
| **`S1` call full** | `features/room-states` | "This call is full." / "Only four participants can join at a time." / "Back to home" (returns to the app root, which re-runs the capacity check). |
| **Connecting** (transient) | `features/call` | Spinner + `Connecting…` between "Enter call" and the room appearing (master §4.6). |

### 5.2 Flow

1. App root loads → `GET /rooms/:room` → `full` ⇒ render `S1`; `available` ⇒ render pre-join.
2. Pre-join requests camera/mic permission on load; the preview shows when granted, otherwise a
   per-device denied message and that toggle is disabled for the session.
3. "Enter call" (name valid) → `POST .../join`:
   - `FULL` ⇒ `S1`; `NAME_TAKEN`/`INVALID_NAME` ⇒ inline error;
   - success ⇒ show `Connecting…`, connect to LiveKit with the token; on the rare connect-time
     capacity rejection from the `maxParticipants` backstop ⇒ `S1`; on other connect failure ⇒
     `Unable to connect to the call service…`.
4. Connected ⇒ in-call shell with the own tile + controls. **Leave** disconnects and returns to the
   app root (which re-checks capacity).

### 5.3 State (Zustand — `.claude/rules/30-state-store.md`)

- `useCallStore` — local mic/cam on-off, connection status, local participant. UI state only.
- `useUiStore` — theme (`dark` default) / language (`en` default). Toggles' UI deferred; the store
  and i18n wiring exist now.

Logic (LiveKit subscriptions, getUserMedia permissions, the API client) lives in hooks/`shared/lib`;
components stay presentational. Components subscribe to the narrowest store slice they need.

### 5.4 i18n

react-i18next, EN/RU parallel resources under `shared/i18n/`, namespaced (`prejoin`, `call`,
`roomStates`, `common`). Every string below is entered verbatim; no hardcoded strings in components.

## 6. Strings (verbatim — master §6 / wireframe)

- `S1`: **"This call is full."** + **"Only four participants can join at a time."** + **"Back to home"**
- Name empty: **"Please enter your name"**
- Name length/chars: **"Name must be 2–30 characters"** (help: "letters, numbers, spaces, hyphens, apostrophes only")
- Name taken: **"That name is already taken in this call."** *(new string — confirm exact EN/RU with design before locking, per master §6)*
- Camera denied: **"Camera access was denied. You can enable it in your browser settings."**
- Mic denied: **"Microphone access was denied. You can enable it in your browser settings."**
- Awaiting device permission: **"Allow camera and microphone access to continue."**
- Connecting: **"Connecting…"**
- Can't reach call service: **"Unable to connect to the call service. Please check your internet connection and try again."**

## 7. Validation rules

- **Name:** 2–30 characters; allowed: letters, numbers, spaces, hyphens, apostrophes.
- **Name uniqueness:** unique within the room, case-insensitive (vs current LiveKit identities) ⇒
  `NAME_TAKEN` on collision.
- **Capacity:** 4 participants total, enforced server-side (soft gate + LiveKit `maxParticipants`
  backstop).
- Validation runs **server-side** at the join boundary; the frontend mirrors it for UX only.

## 8. Testing (co-located, behavior-first — `.claude/rules/60-testing.md`)

**Backend** (mock `listParticipants` + token minting; no real LiveKit):
- Name validation: valid / too short / too long / illegal chars.
- Capacity gate: 0 and 3 participants ⇒ token issued; 4 ⇒ `FULL`.
- Name uniqueness: existing identity (case-insensitive) ⇒ `NAME_TAKEN`.
- `GET` status: <4 ⇒ `available`; =4 ⇒ `full`.

**Frontend** (test hooks/stores directly; components via visible behavior):
- Name-validation hook; pre-join enable/disable of "Enter call".
- Capacity routing: `full` ⇒ `S1` rendered; `available` ⇒ pre-join rendered.
- Device-denied path disables the relevant toggle.

A unit is "done" only when `npm run typecheck` and `npm run lint` are clean — tests don't substitute
for a clean build.

## 9. Open notes & known limitations

- **Soft-gate race.** Counting then connecting is not atomic; two clients can pass the soft gate at
  once. Bounded by LiveKit `maxParticipants: 4`, which rejects the surplus at connect time; the
  frontend treats that as `S1`. Acceptable for a 4-seat room.
- **No registry / no webhooks here.** Presence is read live from LiveKit. The master spec's
  in-memory registry (master §3.1) and webhook-driven presence (master §3.3) are deferred; they
  replace the live-count approach cleanly when host/grace land.
- **Single fixed room.** No creation, links, or roles; `S2`/`S3`/`S4` screens are deferred.
- **"Back to home"** has no landing page yet → returns to the app root, which re-runs the capacity
  check (effectively a retry).

## 10. Forward-compatibility mapping

When later subtasks arrive, this slice extends without rework:

| This subtask | Becomes (master spec) |
| --- | --- |
| Fixed `FIXED_ROOM_NAME` room, no creation | `POST /rooms` creates rooms; host token; participant links (§3.2, §2.1) |
| All participants `role: 'guest'` | host vs guest, host actions, `roomAdmin` grant (§2.1, §4.5) |
| Live-count capacity via `listParticipants` | in-memory registry as authority + LiveKit webhooks (§3.1, §3.3) |
| Own tile only, in-call shell | remote tiles + audio + adaptive grid incl. 2×2 (§4.3 / Subtask 3) |
| `GET` `status: 'available' \| 'full'` | full availability incl. `ended`/`not_found` → `S2`/`S3` (§3.2, §4.2) |
| `join` returns `{ accessToken, livekitUrl, role, identity }` | adds `memberToken` for attachments (§3.2, §3.5) |
