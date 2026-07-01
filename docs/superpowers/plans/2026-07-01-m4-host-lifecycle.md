# M4 — Host Lifecycle: End Call, Remove Guest, Grace Period, Status Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the host authority over the room lifecycle — end the call (destroy the room for everyone), remove a specific guest, and survive a brief disconnect via a 60-second reconnect grace period — and render every resulting status screen (call-ended, host-ended, removed, left, grace overlay) with verbatim PRD copy.

**Architecture:** The backend gains **room lifecycle state** (`status: 'active' | 'grace' | 'ending' | 'ended'` on the registry's `Room`), two host-authenticated endpoints (`POST /rooms/:roomId/end`, `POST /rooms/:roomId/remove`), a **LiveKit webhook receiver** (`webhooks.ts`) that detects unexpected host departure, and a **grace controller** (`grace.ts`) that runs an injectable 1-second countdown, broadcasts `grace_tick`/`grace_cancelled`/`room_ended` over Socket.IO, and destroys the room on expiry. The host slot is reserved during grace so a 4th guest cannot take it. The frontend extends `RoomPage`'s view state machine with the end-of-life screens, adds a host-only "End call" control + per-tile "Remove" control + confirmation modal, and shows the grace overlay over the live call.

**Tech Stack:** Backend — Node 22 + TypeScript (strict, ESM), Express 5, `livekit-server-sdk` (`RoomServiceClient`, `WebhookReceiver`), Socket.IO 4, Zod, Vitest (fake timers). Frontend — React 19 + TypeScript, Vite, `react-router-dom` v7, Zustand, react-i18next, Vitest + Testing Library.

## Global Constraints

- **PRD is binding** (`prd-kmb-video-chat.md`). On any PRD-vs-Figma conflict, PRD wins. Builds on M3 (host/guest model, room registry, per-room admin/tokens, chat-by-roomId, RoomPage state machine).
- **Verbatim UI strings** — copy these EXACTLY (EN); provide a RU parallel for every key (EN/RU parity is enforced by the i18n key-parity test):
  - Call ended (S2): `This call has ended.` · action `Start a new call`
  - Host ended (G5): `The host has ended the call.` · action `Back to home`
  - Removed (G4): `You were removed from the call by the host.` · action `Back to home`
  - Left (G3): `You have left the call.` · action `Rejoin`
  - Grace overlay (G6): `The host lost connection. Waiting for them to return...` (literal three dots, **not** the `…` glyph)
  - Grace countdown (G6): `Reconnecting... {{n}}s` (literal three dots; interpolate `n`)
  - Grace expired (full screen): `The host has disconnected and the call has ended.` · action `Back to home`
  - Remove dialog (H6): `Remove {{name}} from the call?` · buttons `Remove` (red/primary) and `Cancel`
  - Control labels: `End call`, `Leave` (already exists), `Remove`
  - Tooltips (FR-20): `End the call for everyone`, `Leave the call` (exists), `Remove this guest`
- **Security / authority:** every host action (`end`, `remove`) re-validates `hostToken` against the registry server-side (reuse M3's `verifyHostToken`; invalid → `NOT_FOUND`, per FR-7). The client is never trusted for role. The webhook is only acted on after `WebhookReceiver` signature verification.
- **Grace = exactly 60 seconds** (a module constant; overridable via env only for tests). Countdown ticks once per second. Reconnection cancels atomically.
- **Scope boundary (do NOT build here):** screen-share (M6) beyond force-clearing an active share when grace begins; a full idle-room reaper/TTL sweep (see Deferred, §D4) — M4 keeps an in-memory **ended marker** so revisits resolve to S2, but does not implement time-based eviction.
- **Code rules:** no `any`, no `console.log` (use `logger`), no inline `eslint-disable`/`@ts-ignore`, no hardcoded user-facing strings (i18n only), `PascalCase` types with no `I`-prefix, string-literal unions over enums, named exports, `import type` for type-only imports. Backend `npm run typecheck && npm run lint && npm test` and frontend `npm run typecheck` (**= `tsc -b`**, note `tsc --noEmit` is a no-op at the frontend root) `&& npm run lint && npm test` must stay clean. Tests co-located.
- **Socket event maps are duplicated** FE (`frontend/src/shared/lib/socketEvents.ts`) ↔ BE (`backend/src/socket.ts`) by convention (cross-ref comment). Any event added here must be added to BOTH, identically.

---

## Resolved Design Decisions (from the M4 requirements review)

These resolve the open questions surfaced while mapping the spec. **Items marked ⚑ are worth a human confirm before execution** (noted in the handoff).

- **D1 — Removed guest learns the reason via a targeted socket event.** Before calling LiveKit `removeParticipant`, the backend emits `room_ended`-style intent to *that guest's socket only* via a new `participant_removed` event (`{ identity }`). The removed guest's client maps this to the G4 screen. Relying on LiveKit's bare disconnect can't distinguish "removed" from "network drop", so a targeted event is required.
- **D2 — Host navigates on the `end` HTTP response, not on a socket echo.** `POST /rooms/:roomId/end` returns `204`; the host client navigates to `/` immediately. (LiveKit will also disconnect the host; the client ignores that once ending.)
- **D3 — Grace is cancelled by the host's `join` call, not a webhook.** When `POST /rooms/:roomId/join` succeeds with a valid `hostToken` while `status === 'grace'`, the controller calls `grace.cancelGrace(...)`. Simpler and race-free vs. waiting for a `participant_joined` webhook.
- **D4 — Ended rooms keep an in-memory marker; no reaper in M4.** `markEnded` sets `status = 'ended'` and clears secrets/timers but keeps the record so `GET /rooms/:roomId` returns `ended` → S2. Time-based eviction (spec §8, ~1h TTL) is a **deferred follow-up** (M4's registry, like M3's, is unbounded in memory — acceptable for the local single-node deployment). ⚑
- **D5 — Webhook route mounts with `express.raw()` before `express.json()`.** `POST /webhooks/livekit` reads the raw body for `WebhookReceiver` signature verification; it is registered ahead of the JSON body parser so JSON parsing never consumes it.
- **D6 — End-of-life view is driven by socket events, not the LiveKit disconnect.** `CallShell` listens for `room_ended` (`reason: 'host_ended' | 'grace_expired'`) and `participant_removed`, and calls distinct callbacks (`onRoomEnded(reason)`, `onRemoved`). LiveKit's own `onDisconnected` remains wired to the *guest-initiated* leave / connect-error path only. RoomPage maps these to `host-ended` / `ended` / `removed` / `connect-error`.
- **D7 — The per-tile "Remove" control lives on `VideoTile`, gated by role.** `VideoTile` gains an optional `onRemove?: (identity: string) => void`; `VideoGrid` passes it only for remote (guest) tiles when the local role is `host`. Mirrors the M3 `role`-gated `CopyLinkButton` pattern.
- **D8 — Capacity reserves the host slot during grace.** While `status === 'grace'`, the effective cap for *new* joins is `maxParticipants - 1` (3), so a 4th guest cannot occupy the host's reserved slot; a returning host (valid `hostToken`) is exempt from the cap. Implemented in the join controller by consulting `registry.get(roomId).status`.

---

## File Structure

**Backend (`backend/src/`)**
- Modify: `rooms.ts` — add `status`/`graceEndsAt` to `Room`; add `setStatus`, `markEnded`, `startGraceState`, `clearGraceState` registry methods.
- Modify: `rooms.test.ts`.
- Modify: `livekitAdmin.ts` — add `removeParticipant(roomId, identity)` and `deleteRoom(roomId)`.
- Modify: `livekitAdmin.test.ts` (create if absent) — mock `RoomServiceClient`, assert delegation.
- Modify: `errors.ts` / `errors.test.ts` — add `ENDED` (HTTP 410).
- Modify: `routes/rooms/schemeValidator.ts` — add `parseRemoveBody` (`{ hostToken, targetIdentity }`) and `parseEndBody` (`{ hostToken }`).
- Modify: `routes/rooms/controller.ts` — add `end`, `remove`; grace-cancel + ENDED + reserved-slot logic in `join`/`getStatus`.
- Modify: `routes/rooms/router.ts` — add `POST /:roomId/end`, `POST /:roomId/remove`.
- Modify: `routes/rooms/controller.test.ts` / `app.test.ts` — cover new endpoints.
- Create: `grace.ts` — `GraceService` (injectable timers, 1s tick, expiry→end).
- Create: `grace.test.ts` — fake-timer tests.
- Create: `webhooks.ts` — `WebhookReceiver` verify + dispatch (`participant_left` → host? → grace).
- Create: `webhooks.test.ts`.
- Modify: `socket.ts` — add `grace_tick`/`grace_cancelled`/`room_ended`/`participant_removed` to `ServerToClientEvents`; broadcast helpers; widen deps to carry the `io` server + registry.
- Modify: `socket.test.ts`.
- Modify: `config.ts` / `config.test.ts` — add `GRACE_TIMEOUT_SECONDS` (default 60).
- Modify: `app.ts` — webhook raw-body route ordering; widen `AppDeps` (registry already present) to pass grace + io wiring.
- Modify: `server.ts` — construct `grace`, wire webhook receiver + socket broadcasters.

**Frontend (`frontend/src/`)**
- Modify: `shared/i18n/en.ts`, `ru.ts` — all M4 strings (verbatim EN + RU).
- Modify: `shared/i18n/*keys*.test.ts` — assert new keys + parity.
- Modify: `shared/types/index.ts` — `RoomStatus` gains `'ended'`; add `RoomEndReason`.
- Modify: `shared/lib/apiClient.ts` / `apiClient.test.ts` — `endCall`, `removeParticipant`; `getRoomStatus` maps `410`/ended → `'ended'`.
- Modify: `shared/lib/socketEvents.ts` — add `grace_tick`/`grace_cancelled`/`room_ended`/`participant_removed` to `ServerToClientEvents`.
- Modify: `stores/useConnectionStore.ts` / test — add `graceSecondsLeft: number | null` + actions.
- Create: `features/room-states/CallEndedScreen.tsx` (S2), `GuestLeftScreen.tsx` (G3), `RemovedScreen.tsx` (G4), `HostEndedScreen.tsx` (G5) + tests; export from `features/room-states/index.ts`.
- Create: `features/call/components/GraceOverlay.tsx` (G6) + test.
- Create: `features/call/components/RemoveGuestDialog.tsx` (H6) + test.
- Create: `features/call/hooks/useRoomLifecycle.ts` (+ test) — subscribes to the lifecycle socket events, drives store + callbacks.
- Modify: `features/call/components/VideoTile.tsx` — optional host-only `onRemove`.
- Modify: `features/call/components/ControlsBar.tsx` / test — host "End call" (red, ≥24px gap) vs guest "Leave"; tooltips.
- Modify: `features/call/CallShell.tsx` — new props (`roomId`, `hostToken`, `identity`, `onEndCall`, `onRoomEnded`, `onRemoved`); render `GraceOverlay` + `RemoveGuestDialog`; wire `useRoomLifecycle`.
- Modify: `features/call/index.ts` — export new components.
- Modify: `pages/RoomPage.tsx` / test — extend `View`; wire end/remove/grace/left; `getRoomStatus === 'ended'` → S2.

---

# Backend

### Task 1: Room lifecycle state in the registry

**Files:** Modify `backend/src/rooms.ts`, `backend/src/rooms.test.ts`.

**Interfaces:**
- Consumes: existing `RoomRegistry`.
- Produces: `RoomStatus = 'active' | 'grace' | 'ending' | 'ended'`; `Room` gains `status: RoomStatus` (default `'active'` on create) and `graceEndsAt: number | null` (default `null`). `RoomRegistry` gains: `setStatus(roomId, status): void`; `markEnded(roomId): void` (sets `status='ended'`, `graceEndsAt=null`); `startGraceState(roomId, endsAt): void` (sets `status='grace'`, `graceEndsAt=endsAt`); `clearGraceState(roomId): void` (sets `status='active'`, `graceEndsAt=null`). All are no-ops on unknown roomId (consistent with `setHostIdentity`).

- [ ] **Step 1: Write the failing tests** — append to `rooms.test.ts`:

```ts
it('creates rooms in the active status with no grace deadline', () => {
  const registry = createRoomRegistry();
  const room = registry.create();
  expect(room.status).toBe('active');
  expect(room.graceEndsAt).toBeNull();
});

it('transitions status and grace deadline through the lifecycle', () => {
  const registry = createRoomRegistry();
  const room = registry.create();
  registry.startGraceState(room.roomId, 123456);
  expect(registry.get(room.roomId)).toMatchObject({ status: 'grace', graceEndsAt: 123456 });
  registry.clearGraceState(room.roomId);
  expect(registry.get(room.roomId)).toMatchObject({ status: 'active', graceEndsAt: null });
  registry.setStatus(room.roomId, 'ending');
  expect(registry.get(room.roomId)?.status).toBe('ending');
  registry.markEnded(room.roomId);
  expect(registry.get(room.roomId)).toMatchObject({ status: 'ended', graceEndsAt: null });
});

it('lifecycle mutations are no-ops for unknown rooms', () => {
  const registry = createRoomRegistry();
  expect(() => registry.markEnded('ghost')).not.toThrow();
  expect(() => registry.startGraceState('ghost', 1)).not.toThrow();
});
```

- [ ] **Step 2: Run** `cd backend && npx vitest run src/rooms.test.ts` → FAIL (`status` undefined / methods missing).

- [ ] **Step 3: Implement** — in `rooms.ts` add the status type, extend `Room`, default it in `create()`, and add the four methods:

```ts
export type RoomStatus = 'active' | 'grace' | 'ending' | 'ended';

export type Room = {
  roomId: string;
  hostToken: string;
  hostIdentity: string | null;
  createdAt: number;
  status: RoomStatus;        // lifecycle state (M4); starts 'active'
  graceEndsAt: number | null; // epoch ms the grace period ends, else null
};

export type RoomRegistry = {
  create(): Room;
  get(roomId: string): Room | undefined;
  verifyHostToken(roomId: string, token: string): boolean;
  setHostIdentity(roomId: string, identity: string): void;
  setStatus(roomId: string, status: RoomStatus): void;
  markEnded(roomId: string): void;
  startGraceState(roomId: string, endsAt: number): void;
  clearGraceState(roomId: string): void;
};
```

In `create()` set `status: 'active', graceEndsAt: null`. Add the methods (mutate in place, guard on `get`):

```ts
    setStatus(roomId, status) {
      const room = rooms.get(roomId);
      if (room) room.status = status;
    },
    markEnded(roomId) {
      const room = rooms.get(roomId);
      if (room) { room.status = 'ended'; room.graceEndsAt = null; }
    },
    startGraceState(roomId, endsAt) {
      const room = rooms.get(roomId);
      if (room) { room.status = 'grace'; room.graceEndsAt = endsAt; }
    },
    clearGraceState(roomId) {
      const room = rooms.get(roomId);
      if (room) { room.status = 'active'; room.graceEndsAt = null; }
    },
```

Update the deterministic-generator test's `toEqual` (from Task 1 of M3) to include `status: 'active', graceEndsAt: null`.

- [ ] **Step 4: Run** `cd backend && npx vitest run src/rooms.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(backend): room lifecycle state (status + grace deadline) on the registry"` (end every commit message in this plan with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`).

---

### Task 2: LiveKit admin — removeParticipant + deleteRoom

**Files:** Modify `backend/src/livekitAdmin.ts`; `backend/src/livekitAdmin.test.ts` (create if none exists).

**Interfaces:**
- Produces: `LivekitAdmin` gains `removeParticipant(roomId: string, identity: string): Promise<void>` and `deleteRoom(roomId: string): Promise<void>`, delegating to `RoomServiceClient.removeParticipant` and `.deleteRoom`.

- [ ] **Step 1: Write the failing test** — mock the SDK client. Read the existing file first to match its construction; then add:

```ts
import { describe, it, expect, vi } from 'vitest';

const removeParticipant = vi.fn().mockResolvedValue(undefined);
const deleteRoom = vi.fn().mockResolvedValue(undefined);
vi.mock('livekit-server-sdk', () => ({
  RoomServiceClient: vi.fn().mockImplementation(() => ({
    createRoom: vi.fn().mockResolvedValue(undefined),
    listParticipants: vi.fn().mockResolvedValue([]),
    removeParticipant,
    deleteRoom,
  })),
}));

import { createLivekitAdmin } from './livekitAdmin.js';
const config = { livekitHost: 'http://x', livekitApiKey: 'k', livekitApiSecret: 's', maxParticipants: 4, emptyTimeoutSeconds: 300 } as never;

describe('livekitAdmin host actions', () => {
  it('removeParticipant delegates to the SDK with roomId + identity', async () => {
    await createLivekitAdmin(config).removeParticipant('r1', 'p_1');
    expect(removeParticipant).toHaveBeenCalledWith('r1', 'p_1');
  });
  it('deleteRoom delegates to the SDK with roomId', async () => {
    await createLivekitAdmin(config).deleteRoom('r1');
    expect(deleteRoom).toHaveBeenCalledWith('r1');
  });
});
```

> If `livekitAdmin.test.ts` already exists with a client mock, extend that mock's returned object with `removeParticipant`/`deleteRoom` rather than redefining it.

- [ ] **Step 2: Run** `cd backend && npx vitest run src/livekitAdmin.test.ts` → FAIL.
- [ ] **Step 3: Implement** — add to the `LivekitAdmin` type and the returned object:

```ts
    async removeParticipant(roomId, identity) {
      await client.removeParticipant(roomId, identity);
      logger.info({ room: roomId, identity }, 'removed participant');
    },
    async deleteRoom(roomId) {
      await client.deleteRoom(roomId);
      logger.info({ room: roomId }, 'deleted room');
    },
```

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(backend): livekitAdmin removeParticipant + deleteRoom"`.

---

### Task 3: ENDED error code

**Files:** Modify `backend/src/errors.ts`, `backend/src/errors.test.ts`.

**Interfaces:** `ErrorCode` gains `'ENDED'` → HTTP 410 (Gone).

- [ ] **Step 1** — add to `errors.test.ts`:

```ts
it('maps ENDED to 410', () => {
  const err = new AppError('ENDED');
  expect(err.status).toBe(410);
  expect(err.code).toBe('ENDED');
});
```

- [ ] **Step 2: Run** `npx vitest run src/errors.test.ts` → FAIL.
- [ ] **Step 3: Implement** — extend the union and map: `export type ErrorCode = 'FULL' | 'INVALID_NAME' | 'NOT_FOUND' | 'ENDED' | 'INTERNAL';` and add `ENDED: StatusCodes.GONE,` to `STATUS_BY_CODE`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(backend): add ENDED (410) error code"`.

---

### Task 4: Grace controller (`grace.ts`)

**Files:** Create `backend/src/grace.ts`, `backend/src/grace.test.ts`.

**Interfaces:**
- Consumes: `RoomRegistry` (Task 1), `LivekitAdmin.deleteRoom` (Task 2), a broadcast callback, injectable timers/clock.
- Produces: `GraceService = { startGrace(roomId): void; cancelGrace(roomId): void; isInGrace(roomId): boolean }`; `createGraceService(deps: GraceDeps): GraceService` where `GraceDeps = { registry: Pick<RoomRegistry,'get'|'startGraceState'|'clearGraceState'|'markEnded'>; admin: Pick<LivekitAdmin,'deleteRoom'>; graceSeconds: number; onTick(roomId: string, secondsLeft: number): void; onCancelled(roomId: string): void; onEnded(roomId: string, reason: 'grace_expired'): void; now?: () => number; setInterval?: typeof setInterval; clearInterval?: typeof clearInterval }`.

Design: `startGrace` records `graceEndsAt = now + graceSeconds*1000` via `registry.startGraceState`, emits an immediate `onTick(roomId, graceSeconds)`, then ticks every 1s. Each tick computes `secondsLeft = ceil((graceEndsAt - now)/1000)`; if `> 0` emits `onTick`; when `<= 0` it stops the interval, calls `admin.deleteRoom` (best-effort, catch+log via the caller's onEnded path), `registry.markEnded`, and `onEnded(roomId, 'grace_expired')`. `cancelGrace` clears the interval, calls `registry.clearGraceState`, emits `onCancelled`. `isInGrace` reflects an internal `Map<roomId, timer>`. Starting grace on a room already in grace is a no-op (idempotent).

- [ ] **Step 1: Write the failing tests** (fake timers):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGraceService } from './grace.js';

function harness(graceSeconds = 3) {
  const started: Array<[string, number]> = [];
  const registry = {
    get: vi.fn(() => ({ roomId: 'r1', status: 'active', graceEndsAt: null })),
    startGraceState: vi.fn((id: string, endsAt: number) => started.push([id, endsAt])),
    clearGraceState: vi.fn(),
    markEnded: vi.fn(),
  };
  const admin = { deleteRoom: vi.fn().mockResolvedValue(undefined) };
  const ticks: number[] = [];
  const events: string[] = [];
  const svc = createGraceService({
    registry: registry as never, admin: admin as never, graceSeconds,
    onTick: (_id, s) => ticks.push(s),
    onCancelled: () => events.push('cancelled'),
    onEnded: () => events.push('ended'),
  });
  return { svc, registry, admin, ticks, events };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createGraceService', () => {
  it('emits an immediate tick with the full countdown and marks grace state', () => {
    const { svc, registry, ticks } = harness(3);
    svc.startGrace('r1');
    expect(ticks[0]).toBe(3);
    expect(registry.startGraceState).toHaveBeenCalled();
    expect(svc.isInGrace('r1')).toBe(true);
  });

  it('ticks down each second and ends the room at zero', async () => {
    const { svc, admin, registry, ticks, events } = harness(3);
    svc.startGrace('r1');
    await vi.advanceTimersByTimeAsync(3000);
    expect(ticks).toEqual([3, 2, 1]);       // ticks at t=0,1,2s; t=3s triggers end
    expect(admin.deleteRoom).toHaveBeenCalledWith('r1');
    expect(registry.markEnded).toHaveBeenCalledWith('r1');
    expect(events).toContain('ended');
    expect(svc.isInGrace('r1')).toBe(false);
  });

  it('cancelGrace stops the timer and restores active state', () => {
    const { svc, registry, events } = harness(3);
    svc.startGrace('r1');
    svc.cancelGrace('r1');
    expect(registry.clearGraceState).toHaveBeenCalledWith('r1');
    expect(events).toContain('cancelled');
    expect(svc.isInGrace('r1')).toBe(false);
  });

  it('startGrace is idempotent while already in grace', () => {
    const { svc, registry } = harness(3);
    svc.startGrace('r1');
    svc.startGrace('r1');
    expect(registry.startGraceState).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/grace.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `grace.ts`:

```ts
import type { RoomRegistry } from './rooms.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import { logger } from './logger.js';

export type GraceDeps = {
  registry: Pick<RoomRegistry, 'get' | 'startGraceState' | 'clearGraceState' | 'markEnded'>;
  admin: Pick<LivekitAdmin, 'deleteRoom'>;
  graceSeconds: number;
  onTick: (roomId: string, secondsLeft: number) => void;
  onCancelled: (roomId: string) => void;
  onEnded: (roomId: string, reason: 'grace_expired') => void;
  now?: () => number;
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (handle: ReturnType<typeof setInterval>) => void;
};

export type GraceService = {
  startGrace(roomId: string): void;
  cancelGrace(roomId: string): void;
  isInGrace(roomId: string): boolean;
};

export function createGraceService(deps: GraceDeps): GraceService {
  const now = deps.now ?? ((): number => Date.now());
  const setIv = deps.setIntervalFn ?? ((h, ms) => setInterval(h, ms));
  const clearIv = deps.clearIntervalFn ?? ((h) => clearInterval(h));
  const timers = new Map<string, ReturnType<typeof setInterval>>();

  function stop(roomId: string): void {
    const t = timers.get(roomId);
    if (t !== undefined) { clearIv(t); timers.delete(roomId); }
  }

  function endExpired(roomId: string): void {
    stop(roomId);
    // Best-effort LiveKit teardown; mark ended regardless so revisits resolve to S2.
    void deps.admin.deleteRoom(roomId).catch((err: unknown) => logger.error({ err, room: roomId }, 'grace deleteRoom failed'));
    deps.registry.markEnded(roomId);
    deps.onEnded(roomId, 'grace_expired');
  }

  return {
    startGrace(roomId) {
      if (timers.has(roomId)) return; // idempotent
      const endsAt = now() + deps.graceSeconds * 1000;
      deps.registry.startGraceState(roomId, endsAt);
      deps.onTick(roomId, deps.graceSeconds);
      const handle = setIv(() => {
        const secondsLeft = Math.ceil((endsAt - now()) / 1000);
        if (secondsLeft > 0) deps.onTick(roomId, secondsLeft);
        else endExpired(roomId);
      }, 1000);
      timers.set(roomId, handle);
    },
    cancelGrace(roomId) {
      if (!timers.has(roomId)) return;
      stop(roomId);
      deps.registry.clearGraceState(roomId);
      deps.onCancelled(roomId);
    },
    isInGrace(roomId) {
      return timers.has(roomId);
    },
  };
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): grace controller with injectable 1s countdown"`.

---

### Task 5: Socket lifecycle events + broadcasters

**Files:** Modify `backend/src/socket.ts`, `backend/src/socket.test.ts`.

**Interfaces:**
- Produces: `ServerToClientEvents` gains `grace_tick: (p: { secondsLeft: number }) => void`, `grace_cancelled: () => void`, `room_ended: (p: { reason: 'host_ended' | 'grace_expired' }) => void`, `participant_removed: (p: { identity: string }) => void`. New exported broadcast helpers keyed by the `ChatServer`: `emitGraceTick(io, roomId, secondsLeft)`, `emitGraceCancelled(io, roomId)`, `emitRoomEnded(io, roomId, reason)` (each `io.to(roomId).emit(...)`), and `emitParticipantRemoved(io, roomId, identity)` (also `io.to(roomId)`, clients filter by their own identity). **Preserve** the MR3 typed maps / `ChatServer`/`ChatSocket` aliases / guarded listeners — MERGE, do not replace.

- [ ] **Step 1: Write the failing test** — append to `socket.test.ts` (adapt to the file's `makeIo`/fake server helper):

```ts
import { emitGraceTick, emitRoomEnded } from './socket.js';

it('emitGraceTick broadcasts to the room channel', () => {
  const emit = vi.fn();
  const io = { to: vi.fn(() => ({ emit })) } as never;
  emitGraceTick(io, 'r1', 42);
  expect((io as { to: Mock }).to).toHaveBeenCalledWith('r1');
  expect(emit).toHaveBeenCalledWith('grace_tick', { secondsLeft: 42 });
});

it('emitRoomEnded broadcasts the reason to the room channel', () => {
  const emit = vi.fn();
  const io = { to: vi.fn(() => ({ emit })) } as never;
  emitRoomEnded(io, 'r1', 'host_ended');
  expect(emit).toHaveBeenCalledWith('room_ended', { reason: 'host_ended' });
});
```

- [ ] **Step 2: Run** `npx vitest run src/socket.test.ts` → FAIL.
- [ ] **Step 3: Implement** — extend `ServerToClientEvents` (keep the cross-ref comment) and add the helpers at module scope:

```ts
export type RoomEndReason = 'host_ended' | 'grace_expired';

// ...inside ServerToClientEvents, alongside chat_* events:
  grace_tick: (payload: { secondsLeft: number }) => void;
  grace_cancelled: () => void;
  room_ended: (payload: { reason: RoomEndReason }) => void;
  participant_removed: (payload: { identity: string }) => void;

// ...module scope helpers:
export function emitGraceTick(io: ChatServer, roomId: string, secondsLeft: number): void {
  io.to(roomId).emit('grace_tick', { secondsLeft });
}
export function emitGraceCancelled(io: ChatServer, roomId: string): void {
  io.to(roomId).emit('grace_cancelled');
}
export function emitRoomEnded(io: ChatServer, roomId: string, reason: RoomEndReason): void {
  io.to(roomId).emit('room_ended', { reason });
}
export function emitParticipantRemoved(io: ChatServer, roomId: string, identity: string): void {
  io.to(roomId).emit('participant_removed', { identity });
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): socket lifecycle events + broadcast helpers"`.

---

### Task 6: Grace timeout config

**Files:** Modify `backend/src/config.ts`, `backend/src/config.test.ts`.

**Interfaces:** `AppConfig` gains `graceTimeoutSeconds: number`; env `GRACE_TIMEOUT_SECONDS` (coerced positive int, default `60`).

- [ ] **Step 1** — add to `config.test.ts`:

```ts
it('defaults grace timeout to 60 and honours the override', () => {
  expect(loadConfig(base).graceTimeoutSeconds).toBe(60);
  expect(loadConfig({ ...base, GRACE_TIMEOUT_SECONDS: '5' }).graceTimeoutSeconds).toBe(5);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — add `GRACE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),` to `envSchema`, `graceTimeoutSeconds: number;` to `AppConfig`, and `graceTimeoutSeconds: e.GRACE_TIMEOUT_SECONDS,` to the return.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): configurable grace timeout (default 60s)"`.

---

### Task 7: Webhook receiver (`webhooks.ts`)

**Files:** Create `backend/src/webhooks.ts`, `backend/src/webhooks.test.ts`.

**Interfaces:**
- Consumes: `WebhookReceiver` (SDK), `RoomRegistry.get` (Task 1), `GraceService.startGrace` (Task 4).
- Produces: `createWebhookHandler(deps: WebhookDeps)` returning an Express `RequestHandler`. `WebhookDeps = { receiver: { receive(body: string, auth: string | undefined): Promise<WebhookEvent> }; registry: Pick<RoomRegistry,'get'>; grace: Pick<GraceService,'startGrace'> }`. Logic: verify+decode via `receiver.receive(req.body, req.header('Authorization'))`; on `participant_left`, look up the room; if the leaver's identity equals `room.hostIdentity` AND `room.status === 'active'` (unexpected, not an intentional `end`), call `grace.startGrace(roomId)`. Always respond `200`. `receiver.receive` throwing (bad signature) → `401`. The `receiver` is injected so tests don't need real signing.

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createWebhookHandler } from './webhooks.js';

function res() {
  const r = { statusCode: 200, sendStatus: vi.fn((c: number) => { r.statusCode = c; return r; }), end: vi.fn(() => r) };
  return r as never;
}
function req(body: string) { return { body, header: () => 'auth' } as never; }

describe('createWebhookHandler', () => {
  it('starts grace when the host leaves an active room unexpectedly', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_host' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active' })) };
    const handler = createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace });
    await handler(req('{}'), res(), vi.fn());
    expect(grace.startGrace).toHaveBeenCalledWith('r1');
  });

  it('does NOT start grace when a guest leaves', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_guest' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active' })) };
    await createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace })(req('{}'), res(), vi.fn());
    expect(grace.startGrace).not.toHaveBeenCalled();
  });

  it('does NOT start grace when the host leaves an ending room (intentional end)', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_host' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'ending' })) };
    await createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace })(req('{}'), res(), vi.fn());
    expect(grace.startGrace).not.toHaveBeenCalled();
  });

  it('responds 401 on a bad signature', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockRejectedValue(new Error('bad sig')) };
    const r = res();
    await createWebhookHandler({ receiver: receiver as never, registry: { get: vi.fn() } as never, grace })(req('{}'), r, vi.fn());
    expect((r as { sendStatus: Mock }).sendStatus).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `webhooks.ts`:

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { WebhookEvent } from 'livekit-server-sdk';
import type { RoomRegistry } from './rooms.js';
import type { GraceService } from './grace.js';
import { logger } from './logger.js';

export type WebhookDeps = {
  receiver: { receive(body: string, auth: string | undefined): Promise<WebhookEvent> };
  registry: Pick<RoomRegistry, 'get'>;
  grace: Pick<GraceService, 'startGrace'>;
};

export function createWebhookHandler(deps: WebhookDeps): RequestHandler {
  return async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    let event: WebhookEvent;
    try {
      // req.body is a raw string/Buffer (express.raw()); receiver verifies the LiveKit signature.
      event = await deps.receiver.receive(req.body as string, req.header('Authorization'));
    } catch (err: unknown) {
      logger.error({ err }, 'webhook signature verification failed');
      res.sendStatus(401);
      return;
    }
    if (event.event === 'participant_left') {
      const roomId = event.room?.name;
      const identity = event.participant?.identity;
      const room = roomId !== undefined ? deps.registry.get(roomId) : undefined;
      if (room && identity === room.hostIdentity && room.status === 'active') {
        deps.grace.startGrace(room.roomId);
      }
    }
    res.sendStatus(200);
  };
}
```

> The real `WebhookReceiver` is `new WebhookReceiver(apiKey, apiSecret)`; `.receive(body, authHeader)`. Verify the installed SDK's exact `WebhookEvent` field names (`event`, `room.name`, `participant.identity`) when wiring in Task 10 — adjust if the SDK differs.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): LiveKit webhook receiver → host-left triggers grace"`.

---

### Task 8: Host-action endpoints — end + remove (+ join/getStatus lifecycle)

**Files:** Modify `backend/src/routes/rooms/schemeValidator.ts`, `controller.ts`, `router.ts`; `backend/src/app.test.ts` (or `controller.test.ts`).

**Interfaces:**
- Produces:
  - `parseEndBody(body): { hostToken: string }`; `parseRemoveBody(body): { hostToken: string; targetIdentity: string }` (both throw `INVALID_NAME`→ reuse, or a generic `NOT_FOUND` on shape failure — use a Zod parse that throws `AppError('NOT_FOUND')` since these are host-only paths).
  - `RoomsControllerDeps` widens to `{ config; registry; admin: Pick<LivekitAdmin,'ensureRoom'|'listParticipantCount'|'removeParticipant'|'deleteRoom'>; minter; grace: Pick<GraceService,'cancelGrace'>; io: ChatServer }` (the controller needs to broadcast + cancel grace).
  - `RoomsController` gains `end(req,res)` and `remove(req,res)`.
  - Routes: `POST /rooms/:roomId/end` → `204`; `POST /rooms/:roomId/remove` → `204`.
  - `getStatus`: if `room.status === 'ended'` → `{ status: 'ended' }`. `join`: if `room.status === 'ended'` → `AppError('ENDED')`; if `status === 'grace'` and a valid host token → `grace.cancelGrace(roomId)` then proceed as host; reserved-slot capacity: guests blocked at `maxParticipants - 1` while in grace.

- [ ] **Step 1: Write the failing tests** — extend `app.test.ts`. Add `removeParticipant`/`deleteRoom` to the admin mock, `cancelGrace` to a grace mock, and an `io` fake `{ to: () => ({ emit: vi.fn() }) }`:

```ts
describe('POST /rooms/:roomId/end', () => {
  it('ends the room (204), sets ending status, deletes the LiveKit room, broadcasts room_ended', async () => {
    const { app, registry, admin, io } = makeApp(2);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/end`).send({ hostToken: room.hostToken });
    expect(res.status).toBe(204);
    expect(admin.deleteRoom).toHaveBeenCalledWith(room.roomId);
    expect(registry.get(room.roomId)?.status).toBe('ended');
    expect(io.to).toHaveBeenCalledWith(room.roomId); // room_ended broadcast
  });
  it('rejects a wrong host token with 404', async () => {
    const { app, registry } = makeApp(2);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/end`).send({ hostToken: 'wrong' });
    expect(res.status).toBe(404);
  });
});

describe('POST /rooms/:roomId/remove', () => {
  it('removes a guest (204) via LiveKit and notifies the guest', async () => {
    const { app, registry, admin, io } = makeApp(3);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/remove`).send({ hostToken: room.hostToken, targetIdentity: 'p_guest' });
    expect(res.status).toBe(204);
    expect(admin.removeParticipant).toHaveBeenCalledWith(room.roomId, 'p_guest');
    expect(io.to).toHaveBeenCalledWith(room.roomId); // participant_removed broadcast
  });
  it('rejects a wrong host token with 404', async () => {
    const { app, registry, admin } = makeApp(3);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/remove`).send({ hostToken: 'wrong', targetIdentity: 'p_guest' });
    expect(res.status).toBe(404);
    expect(admin.removeParticipant).not.toHaveBeenCalled();
  });
});

describe('join lifecycle', () => {
  it('returns ENDED (410) when joining an ended room', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    registry.markEnded(room.roomId);
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: 'ENDED' });
  });
  it('cancels grace and admits the returning host', async () => {
    const { app, registry, grace } = makeApp(0);
    const room = registry.create();
    registry.startGraceState(room.roomId, 1);
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Host', hostToken: room.hostToken });
    expect(res.body.role).toBe('host');
    expect(grace.cancelGrace).toHaveBeenCalledWith(room.roomId);
  });
  it('reserves the host slot: a 4th guest is refused (FULL) during grace at 3 participants', async () => {
    const { app, registry } = makeApp(3);   // 3 live guests
    const room = registry.create();
    registry.startGraceState(room.roomId, 1);
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Guest4' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'FULL' });
  });
});

describe('GET status ended', () => {
  it('returns ended for an ended room', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    registry.markEnded(room.roomId);
    const res = await request(app).get(`/rooms/${room.roomId}`);
    expect(res.body).toEqual({ status: 'ended' });
  });
});
```

Update `makeApp` to construct the widened deps (`grace = { cancelGrace: vi.fn() }`, `io = { to: vi.fn(() => ({ emit: vi.fn() })) }`, admin with `removeParticipant`/`deleteRoom`).

- [ ] **Step 2: Run** `npx vitest run src/app.test.ts` → FAIL.
- [ ] **Step 3: Validators** — in `schemeValidator.ts` add:

```ts
const endBodySchema = z.object({ hostToken: z.string().min(1) });
export function parseEndBody(body: unknown): { hostToken: string } {
  const r = endBodySchema.safeParse(body);
  if (!r.success) throw new AppError('NOT_FOUND');
  return r.data;
}
const removeBodySchema = z.object({ hostToken: z.string().min(1), targetIdentity: z.string().min(1) });
export function parseRemoveBody(body: unknown): { hostToken: string; targetIdentity: string } {
  const r = removeBodySchema.safeParse(body);
  if (!r.success) throw new AppError('NOT_FOUND');
  return r.data;
}
```

- [ ] **Step 4: Controller** — widen `RoomsControllerDeps`, import `ChatServer` + the broadcast helpers + `GraceService`, and add `end`/`remove` plus the `join`/`getStatus` lifecycle logic:

```ts
import { emitRoomEnded, emitParticipantRemoved } from '../../socket.js';
import type { ChatServer } from '../../socket.js';
import type { GraceService } from '../../grace.js';
import { parseEndBody, parseRemoveBody, parseJoinBody } from './schemeValidator.js';

// deps: add `admin: Pick<LivekitAdmin,'ensureRoom'|'listParticipantCount'|'removeParticipant'|'deleteRoom'>;
//        grace: Pick<GraceService,'cancelGrace'>; io: ChatServer;`

async function end(req, res): Promise<void> {
  const { roomId } = req.params; if (typeof roomId !== 'string') throw new AppError('NOT_FOUND');
  const room = registry.get(roomId); if (!room) throw new AppError('NOT_FOUND');
  const { hostToken } = parseEndBody(req.body);
  if (!registry.verifyHostToken(roomId, hostToken)) throw new AppError('NOT_FOUND');
  registry.setStatus(roomId, 'ending');       // flag so the host-left webhook is treated as intentional
  emitRoomEnded(io, roomId, 'host_ended');     // tell guests before teardown
  await admin.deleteRoom(roomId);
  registry.markEnded(roomId);
  res.sendStatus(204);
}

async function remove(req, res): Promise<void> {
  const { roomId } = req.params; if (typeof roomId !== 'string') throw new AppError('NOT_FOUND');
  const room = registry.get(roomId); if (!room) throw new AppError('NOT_FOUND');
  const { hostToken, targetIdentity } = parseRemoveBody(req.body);
  if (!registry.verifyHostToken(roomId, hostToken)) throw new AppError('NOT_FOUND');
  emitParticipantRemoved(io, roomId, targetIdentity);   // guest learns the reason before the kick
  await admin.removeParticipant(roomId, targetIdentity);
  res.sendStatus(204);
}
```

In `getStatus`, before the count check: `if (room.status === 'ended') { res.json({ status: 'ended' }); return; }`.

In `join`, after `const room = registry.get(roomId)` guard:
```ts
  if (room.status === 'ended') throw new AppError('ENDED');
  // ...parse body, verify hostToken as in M3...
  const isHost = hostToken !== undefined; // (already validated above → role 'host')
  if (isHost && room.status === 'grace') grace.cancelGrace(roomId);
  const count = await admin.listParticipantCount(roomId);
  const cap = (!isHost && room.status === 'grace') ? config.maxParticipants - 1 : config.maxParticipants;
  if (count >= cap) throw new AppError('FULL');
```
(Keep the rest of M3's join: host-token verify → role, mint token, `setHostIdentity`, response shape.)

- [ ] **Step 5: Router** — add to `createRoomsRouter`:
```ts
  router.post('/:roomId/end', asyncHandler(controller.end));
  router.post('/:roomId/remove', asyncHandler(controller.remove));
```
Return `{ create, getStatus, join, end, remove }` from the controller.

- [ ] **Step 6: Run** `npx vitest run src/app.test.ts src/errors.test.ts` → PASS.
- [ ] **Step 7: Commit** — `git commit -m "feat(backend): host end/remove endpoints + grace-aware join/status"`.

---

### Task 9: Server composition — webhook route + grace wiring

**Files:** Modify `backend/src/app.ts`, `backend/src/server.ts`.

**Interfaces:** `app.ts` mounts `POST /webhooks/livekit` with `express.raw({ type: '*/*' })` BEFORE `express.json()`, using an injected `webhookHandler`. `server.ts` builds `grace` (wired to socket broadcasters + registry + admin), the `WebhookReceiver`, and passes `grace` + `io` into the rooms controller deps.

- [ ] **Step 1: Wire `server.ts`** — after `createSocketServer(...)` yields `io`, and before/after building the app, construct the grace service with broadcasters bound to `io`, then the webhook handler, then create the app with the widened deps:

```ts
import { WebhookReceiver } from 'livekit-server-sdk';
import { createGraceService } from './grace.js';
import { createWebhookHandler } from './webhooks.js';
import { emitGraceTick, emitGraceCancelled, emitRoomEnded } from './socket.js';

const httpServer = createServer(/* app built after io? */);
const io = createSocketServer(httpServer, { config, admin, chat });
const grace = createGraceService({
  registry, admin, graceSeconds: config.graceTimeoutSeconds,
  onTick: (roomId, s) => emitGraceTick(io, roomId, s),
  onCancelled: (roomId) => emitGraceCancelled(io, roomId),
  onEnded: (roomId, reason) => emitRoomEnded(io, roomId, reason),
});
const receiver = new WebhookReceiver(config.livekitApiKey, config.livekitApiSecret);
const webhookHandler = createWebhookHandler({ receiver, registry, grace });
const app = createApp({ config, registry, admin, minter, grace, io, webhookHandler });
httpServer.on('request', app); // or restructure: build app first without io, attach io broadcasters via a setter
```

> **Ordering note:** `createApp` needs `io` (for the controller broadcasters) and `io` needs the `httpServer` which wraps `app`. Break the cycle by creating the bare `httpServer` first, then `io`, then `app`, and mounting the app via `httpServer.on('request', app)`; OR pass a lazy `() => io` getter into the controller deps. Choose the getter approach if `createServer(app)` must own the app. Document the chosen wiring in the commit.

- [ ] **Step 2: `app.ts`** — add the webhook route before the JSON parser, and widen `AppDeps`:

```ts
export type AppDeps = {
  config: AppConfig;
  registry: RoomRegistry;
  admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount' | 'removeParticipant' | 'deleteRoom'>;
  minter: TokenMinter;
  grace: Pick<GraceService, 'cancelGrace'>;
  io: ChatServer;
  webhookHandler: RequestHandler;
};
// ...in createApp, BEFORE express.json():
app.post('/webhooks/livekit', express.raw({ type: '*/*' }), deps.webhookHandler);
app.use(express.json());
app.use(createRootRouter(deps)); // forwards grace + io to the rooms controller
```

Ensure `routes/index.ts` forwards `grace` + `io` (they ride along in the deps object like `registry` did in M3).

- [ ] **Step 3: Full backend gate** — `cd backend && npm run typecheck && npm run lint && npm test` → all clean/PASS.
- [ ] **Step 4: Commit** — `git commit -m "refactor(backend): wire grace service + LiveKit webhook route"`.

---

# Frontend

### Task 10: i18n strings (all M4 screens/controls)

**Files:** Modify `frontend/src/shared/i18n/en.ts`, `ru.ts`, and the key-parity test.

**Interfaces:** `roomStates` gains `endedTitle`, `hostEndedTitle`, `leftTitle`, `rejoin`, `removedTitle`, `graceOverlay`, `graceCountdown`, `graceExpiredTitle`, `removeDialogTitle`, `removeConfirm`, `removeCancel`. `call` gains `endCall`, `endCallTooltip`, `removeGuest`, `removeGuestTooltip`. (`startNewCall`, `backToHome`, `leave`, `leaveTooltip` already exist.)

- [ ] **Step 1: Parity test (red)** — add to the i18n keys test:

```ts
it('exposes M4 roomStates + call keys with EN/RU parity', () => {
  for (const k of ['endedTitle','hostEndedTitle','leftTitle','rejoin','removedTitle','graceOverlay','graceCountdown','graceExpiredTitle','removeDialogTitle','removeConfirm','removeCancel'])
    expect(en.roomStates).toHaveProperty(k);
  for (const k of ['endCall','endCallTooltip','removeGuest','removeGuestTooltip'])
    expect(en.call).toHaveProperty(k);
  expect(Object.keys(ru.roomStates)).toEqual(Object.keys(en.roomStates));
  expect(Object.keys(ru.call)).toEqual(Object.keys(en.call));
  expect(en.roomStates.graceExpiredTitle).toBe('The host has disconnected and the call has ended.');
  expect(en.roomStates.graceCountdown).toBe('Reconnecting... {{n}}s');
});
```

- [ ] **Step 2: Run** `npx vitest run src/shared/i18n` → FAIL.
- [ ] **Step 3: Add EN** (`en.ts`) — into `roomStates`:

```ts
    endedTitle: 'This call has ended.',
    hostEndedTitle: 'The host has ended the call.',
    leftTitle: 'You have left the call.',
    rejoin: 'Rejoin',
    removedTitle: 'You were removed from the call by the host.',
    graceOverlay: 'The host lost connection. Waiting for them to return...',
    graceCountdown: 'Reconnecting... {{n}}s',
    graceExpiredTitle: 'The host has disconnected and the call has ended.',
    removeDialogTitle: 'Remove {{name}} from the call?',
    removeConfirm: 'Remove',
    removeCancel: 'Cancel',
```
into `call`:
```ts
    endCall: 'End call',
    endCallTooltip: 'End the call for everyone',
    removeGuest: 'Remove',
    removeGuestTooltip: 'Remove this guest',
```

- [ ] **Step 4: Add RU** (`ru.ts`) — mirror every key:

```ts
    endedTitle: 'Звонок завершён.',
    hostEndedTitle: 'Организатор завершил звонок.',
    leftTitle: 'Вы покинули звонок.',
    rejoin: 'Вернуться',
    removedTitle: 'Организатор удалил вас из звонка.',
    graceOverlay: 'Организатор потерял соединение. Ожидаем его возвращения...',
    graceCountdown: 'Переподключение... {{n}} с',
    graceExpiredTitle: 'Организатор отключился, звонок завершён.',
    removeDialogTitle: 'Удалить {{name}} из звонка?',
    removeConfirm: 'Удалить',
    removeCancel: 'Отмена',
```
```ts
    endCall: 'Завершить звонок',
    endCallTooltip: 'Завершить звонок для всех',
    removeGuest: 'Удалить',
    removeGuestTooltip: 'Удалить этого участника',
```

- [ ] **Step 5: Run** `npx vitest run src/shared/i18n && npm run typecheck` → PASS/clean (RU parity enforced by the `Translations` type).
- [ ] **Step 6: Commit** — `git commit -m "feat(frontend): i18n for M4 lifecycle screens + controls (EN/RU)"`.

---

### Task 11: Shared types + API client + socket events

**Files:** Modify `frontend/src/shared/types/index.ts`, `shared/lib/apiClient.ts`, `apiClient.test.ts`, `shared/lib/socketEvents.ts`.

**Interfaces:**
- `RoomStatus` gains `'ended'`; add `RoomEndReason = 'host_ended' | 'grace_expired'`.
- `apiClient`: `endCall(roomId, hostToken): Promise<boolean>` (204→true, else false); `removeParticipant(roomId, hostToken, targetIdentity): Promise<boolean>`; `getRoomStatus` returns `'ended'` on HTTP 410. Follow the post-MR3 convention (no schemas on these low-stakes calls; documented behavior).
- `socketEvents.ts`: `ServerToClientEvents` gains `grace_tick`, `grace_cancelled`, `room_ended`, `participant_removed` (identical to backend Task 5).

- [ ] **Step 1: apiClient tests (red)** — add:

```ts
describe('endCall / removeParticipant', () => {
  it('endCall posts the host token and returns true on 204', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    expect(await endCall('r1', 'h1')).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ hostToken: 'h1' });
  });
  it('removeParticipant posts hostToken + targetIdentity', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    expect(await removeParticipant('r1', 'h1', 'p_2')).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ hostToken: 'h1', targetIdentity: 'p_2' });
  });
});
it('getRoomStatus maps 410 to ended', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 410, json: () => Promise.resolve({ error: 'ENDED' }) } as Response);
  expect(await getRoomStatus('r1')).toBe('ended');
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — in `types/index.ts` `export type RoomStatus = 'available' | 'full' | 'not-found' | 'ended';` and `export type RoomEndReason = 'host_ended' | 'grace_expired';`. In `apiClient.ts`:

```ts
const endUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'end');
const removeUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'remove');

export async function endCall(roomId: string, hostToken: string): Promise<boolean> {
  const res = await fetch(endUrl(roomId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostToken }) });
  return res.ok;
}
export async function removeParticipant(roomId: string, hostToken: string, targetIdentity: string): Promise<boolean> {
  const res = await fetch(removeUrl(roomId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostToken, targetIdentity }) });
  return res.ok;
}
```
In `getRoomStatus`, before the existing 404 check: `if (res.status === 410) return 'ended';` (keep 404→'not-found', non-ok non-404/410 → throw). In `socketEvents.ts` add the four events to `ServerToClientEvents` (mirror backend; keep the cross-ref comment).

- [ ] **Step 4: Run** `npx vitest run src/shared/lib/apiClient.test.ts && npm run typecheck` → PASS/clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): apiClient end/remove + ended status + lifecycle socket events"`.

---

### Task 12: Grace countdown store state

**Files:** Modify `frontend/src/stores/useConnectionStore.ts`, `useConnectionStore.test.ts`.

**Interfaces:** `useConnectionStore` gains `graceSecondsLeft: number | null` (default `null`), `setGraceSecondsLeft(n: number | null): void`; `reset()` also clears it to `null`.

- [ ] **Step 1: Test (red)** — add:

```ts
it('tracks grace countdown and clears it on reset', () => {
  const s = useConnectionStore.getState();
  s.setGraceSecondsLeft(42);
  expect(useConnectionStore.getState().graceSecondsLeft).toBe(42);
  useConnectionStore.getState().reset();
  expect(useConnectionStore.getState().graceSecondsLeft).toBeNull();
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — add `graceSecondsLeft: number | null` to the state type (default `null`), `setGraceSecondsLeft: (n) => set({ graceSecondsLeft: n })`, and include `graceSecondsLeft: null` in the `reset()` payload.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): grace countdown state in connection store"`.

---

### Task 13: Status screens (S2 / G3 / G4 / G5)

**Files:** Create `CallEndedScreen.tsx`, `GuestLeftScreen.tsx`, `RemovedScreen.tsx`, `HostEndedScreen.tsx` + tests under `frontend/src/features/room-states/`; modify `index.ts`.

**Interfaces:**
- `CallEndedScreen` — no props; `Link to="/"` action `startNewCall` (mirror `InvalidLinkScreen`).
- `GuestLeftScreen` — `{ onRejoin: () => void }`; `Button variant="ghost"` action `rejoin`.
- `RemovedScreen` — no props; `Link to="/"` action `backToHome`.
- `HostEndedScreen` — no props; `Link to="/"` action `backToHome`.
All use the shared pattern: `useTranslation('roomStates')`, `<Text tag="h1" size="2xl" weight="semibold">` title, container `mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center`. **Use the real `<Text>` API — no `variant` prop.**

- [ ] **Step 1: Tests (red)** — one per screen, e.g. `HostEndedScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { HostEndedScreen } from './HostEndedScreen';
it('shows the host-ended message and a back-to-home link', () => {
  render(<MemoryRouter><HostEndedScreen /></MemoryRouter>);
  expect(screen.getByText('The host has ended the call.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
});
```
`CallEndedScreen.test.tsx` asserts `This call has ended.` + link `/`; `RemovedScreen.test.tsx` asserts `You were removed from the call by the host.` + link `/`; `GuestLeftScreen.test.tsx` renders with an `onRejoin` spy, asserts `You have left the call.` and that clicking `Rejoin` calls it.

- [ ] **Step 2: Run** the four test files → FAIL.
- [ ] **Step 3: Implement** — e.g. `HostEndedScreen.tsx` (the others mirror it; `GuestLeftScreen` uses a Button + `onRejoin` instead of a Link):

```tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Text } from '../../shared/ui/Text';

export function HostEndedScreen(): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('hostEndedTitle')}</Text>
      <Link to="/" className="rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted">{t('backToHome')}</Link>
    </div>
  );
}
```
`GuestLeftScreen.tsx`:
```tsx
export type GuestLeftScreenProps = { onRejoin: () => void };
export function GuestLeftScreen({ onRejoin }: GuestLeftScreenProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text tag="h1" size="2xl" weight="semibold">{t('leftTitle')}</Text>
      <Button variant="ghost" onClick={onRejoin}>{t('rejoin')}</Button>
    </div>
  );
}
```

- [ ] **Step 4: Export** all four from `index.ts`. **Step 5: Run** `npx vitest run src/features/room-states` → PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat(frontend): S2/G3/G4/G5 lifecycle status screens"`.

---

### Task 14: Grace overlay (G6)

**Files:** Create `frontend/src/features/call/components/GraceOverlay.tsx` + test.

**Interfaces:** `GraceOverlay` — `{ secondsLeft: number }`. Renders an absolutely-positioned overlay (does NOT unmount the call) showing `roomStates.graceOverlay` and `roomStates.graceCountdown` with `{{n}}` = `secondsLeft`. `useTranslation('roomStates')`.

- [ ] **Step 1: Test (red)**:

```tsx
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { GraceOverlay } from './GraceOverlay';
it('shows the waiting message and the countdown', () => {
  render(<GraceOverlay secondsLeft={47} />);
  expect(screen.getByText('The host lost connection. Waiting for them to return...')).toBeInTheDocument();
  expect(screen.getByText('Reconnecting... 47s')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement:**

```tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../shared/ui/Text';

export type GraceOverlayProps = { secondsLeft: number };
export function GraceOverlay({ secondsLeft }: GraceOverlayProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-4 z-20 mx-auto flex max-w-md flex-col items-center gap-1 rounded-lg bg-surface-elevated/90 p-4 text-center">
      <Text tag="p" weight="medium" className="text-slate-100">{t('graceOverlay')}</Text>
      <Text tag="p" size="sm" className="text-slate-300">{t('graceCountdown', { n: secondsLeft })}</Text>
    </div>
  );
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): grace-period overlay (G6)"`.

---

### Task 15: Remove-guest dialog (H6) + VideoTile remove control

**Files:** Create `frontend/src/features/call/components/RemoveGuestDialog.tsx` + test; modify `frontend/src/features/call/components/VideoTile.tsx`.

**Interfaces:**
- `RemoveGuestDialog` — `{ name: string; onConfirm: () => void; onCancel: () => void }`. Modal (`role="dialog"`, `aria-modal`) with title `roomStates.removeDialogTitle` (`{{name}}`), a red primary `Remove` (`removeConfirm`) and a `Cancel` (`removeCancel`). Backdrop click / Esc → `onCancel`.
- `VideoTile` gains optional `onRemove?: () => void`; when present, render a host-only `Remove` control (`call.removeGuest`), revealed on hover/focus, wrapped in a `Tooltip label={t('call.removeGuestTooltip')}` (use the shared `Tooltip` — never the native `title`).

- [ ] **Step 1: Tests (red)** — `RemoveGuestDialog.test.tsx`:

```tsx
it('renders the interpolated title and wires confirm/cancel', () => {
  const onConfirm = vi.fn(), onCancel = vi.fn();
  render(<RemoveGuestDialog name="Ann" onConfirm={onConfirm} onCancel={onCancel} />);
  expect(screen.getByText('Remove Ann from the call?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^remove$/i })); expect(onConfirm).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^cancel$/i })); expect(onCancel).toHaveBeenCalled();
});
```
For `VideoTile`, add a test (adapt to the existing VideoTile test harness) that a `Remove` button appears when `onRemove` is passed and is absent when it isn't.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `RemoveGuestDialog.tsx`:

```tsx
import { useEffect } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { Text } from '../../../shared/ui/Text';

export type RemoveGuestDialogProps = { name: string; onConfirm: () => void; onCancel: () => void };
export function RemoveGuestDialog({ name, onConfirm, onCancel }: RemoveGuestDialogProps): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const { t } = useTranslation('roomStates');
  return (
    <div role="presentation" className="fixed inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div role="dialog" aria-modal="true" className="flex flex-col gap-4 rounded-xl bg-surface-elevated p-6" onClick={(e) => e.stopPropagation()}>
        <Text tag="h2" size="lg" weight="semibold" className="text-slate-100">{t('removeDialogTitle', { name })}</Text>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>{t('removeCancel')}</Button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger/90">{t('removeConfirm')}</button>
        </div>
      </div>
    </div>
  );
}
```
> `bg-danger` is a defined theme token (`--color-danger`); the red confirm is a bare `<button>` since the shared `Button` has no danger variant. (Consider adding a `danger` variant to `Button` as a follow-up.) In `VideoTile.tsx`, add the optional `onRemove?: () => void` prop and render, when set, a hover/focus-revealed `Tooltip`-wrapped `Remove` button that calls `onRemove`.

- [ ] **Step 4: Run** `npx vitest run src/features/call` → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): remove-guest dialog (H6) + host-only tile remove control"`.

---

### Task 16: Room lifecycle hook + CallShell wiring + ControlsBar

**Files:** Create `frontend/src/features/call/hooks/useRoomLifecycle.ts` + test; modify `CallShell.tsx`, `ControlsBar.tsx`, `ControlsBar.test.tsx`, `features/call/index.ts`, `VideoGrid.tsx`.

**Interfaces:**
- `useRoomLifecycle({ identity, onRoomEnded, onRemoved })` — consumes `useSocket()`; on `grace_tick` → `setGraceSecondsLeft(secondsLeft)`; on `grace_cancelled` → `setGraceSecondsLeft(null)`; on `room_ended` → `onRoomEnded(reason)`; on `participant_removed` → if `payload.identity === identity` call `onRemoved()`. Registers/`off`s the exact handlers on cleanup (never `removeAllListeners`).
- `ControlsBarProps` gains `onEndCall: () => void`; renders, for `role === 'host'`, a red `End call` button (`call.endCall`, tooltip `call.endCallTooltip`) with `ml-6` (≥24px) separation, INSTEAD of the guest `Leave` button; guest keeps `Leave`.
- `CallShellProps` gains `roomId`, `hostToken?`, `identity`, `onEndCall`, `onRoomEnded: (r: RoomEndReason) => void`, `onRemoved: () => void`. `CallShell` calls `useRoomLifecycle`, renders `<GraceOverlay secondsLeft={graceSecondsLeft} />` when `graceSecondsLeft !== null`, and manages the `RemoveGuestDialog` open/target state (opened from a tile's `onRemove`, confirmed → `apiClient.removeParticipant(roomId, hostToken!, targetIdentity)`). `VideoGrid` passes `onRemove` to remote tiles only when `role === 'host'`.

- [ ] **Step 1: Hook test (red)** — mock `useSocket` with a fake emitter capturing handlers; assert `grace_tick`→store, `participant_removed` with matching identity → `onRemoved`, non-matching → not called, and that cleanup calls `socket.off` for each handler.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `useRoomLifecycle.ts`:

```ts
import { useEffect } from 'react';
import { useSocket } from '../../../shared/lib/SocketProvider';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import type { RoomEndReason } from '../../../shared/types';

export function useRoomLifecycle(args: { identity: string; onRoomEnded: (r: RoomEndReason) => void; onRemoved: () => void }): void {
  const socket = useSocket();
  const setGrace = useConnectionStore((s) => s.setGraceSecondsLeft);
  useEffect(() => {
    const onTick = (p: { secondsLeft: number }): void => setGrace(p.secondsLeft);
    const onCancelled = (): void => setGrace(null);
    const onEnded = (p: { reason: RoomEndReason }): void => args.onRoomEnded(p.reason);
    const onRemoved = (p: { identity: string }): void => { if (p.identity === args.identity) args.onRemoved(); };
    socket.on('grace_tick', onTick);
    socket.on('grace_cancelled', onCancelled);
    socket.on('room_ended', onEnded);
    socket.on('participant_removed', onRemoved);
    return () => {
      socket.off('grace_tick', onTick);
      socket.off('grace_cancelled', onCancelled);
      socket.off('room_ended', onEnded);
      socket.off('participant_removed', onRemoved);
    };
  }, [socket, setGrace, args]);
}
```

- [ ] **Step 4: ControlsBar** — add `onEndCall`; render host end vs guest leave:
```tsx
{role === 'host'
  ? <Tooltip label={t('call.endCallTooltip')}><button type="button" onClick={onEndCall} className="ml-6 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger/90">{t('call.endCall')}</button></Tooltip>
  : <Button variant="ghost" onClick={onLeave}>{t('call.leave')}</Button>}
```
(Keep `CopyLinkButton` host-only as-is.) Update `ControlsBar.test.tsx` to pass `onEndCall` and assert host sees `End call` / guest sees `Leave`.
- [ ] **Step 5: CallShell** — add the new props; call `useRoomLifecycle({ identity, onRoomEnded, onRemoved })`; subscribe to `graceSecondsLeft` and render `GraceOverlay`; hold `removeTarget` state; render `RemoveGuestDialog` when set; pass `onEndCall` to `ControlsBar` and `onRemove`→open-dialog to `VideoGrid`/tiles (host only). Confirm → `await removeParticipant(roomId, hostToken ?? '', removeTarget.identity)` then clear.
- [ ] **Step 6: Run** `npx vitest run src/features/call` → PASS. **Step 7: Commit** — `git commit -m "feat(frontend): room-lifecycle hook, grace overlay + end/remove wiring in CallShell/ControlsBar"`.

---

### Task 17: RoomPage integration (end / left / removed / host-ended / ended)

**Files:** Modify `frontend/src/pages/RoomPage.tsx`, `RoomPage.test.tsx`.

**Interfaces:** `View` gains `'ended' | 'left' | 'removed' | 'host-ended'`. Wiring:
- Mount `getRoomStatus`: `'ended'` → view `'ended'` (S2).
- Guest `onLeave` (from CallShell/ControlsBar) → view `'left'` (G3), NOT recheckCapacity.
- Host `onEndCall` → `await endCall(roomId, hostToken!)` → `navigate('/')`.
- `onRoomEnded(reason)` → `reason === 'host_ended'` → `'host-ended'` (G5); `reason === 'grace_expired'` → `'ended'` with the grace-expired copy (G6 full-screen). Reuse `HostEndedScreen` for `host_ended`; render a dedicated grace-expired message for `grace_expired` (use `roomStates.graceExpiredTitle` in a small inline screen or a `GraceExpiredScreen`).
- `onRemoved` → view `'removed'` (G4).
- Pass `roomId`, `hostToken`, `identity`, `onEndCall`, `onRoomEnded`, `onRemoved` into `CallShell`. `GuestLeftScreen`'s `onRejoin` → back to `prejoin` (reset stores, recheck capacity).

- [ ] **Step 1: Tests (red)** — extend `RoomPage.test.tsx` (its `CallShell` mock now captures `onRoomEnded`/`onRemoved`/`onEndCall`/`onLeave`). Cases: status `'ended'`→`This call has ended.`; guest leave→`You have left the call.` + Rejoin returns to prejoin; `onRoomEnded('host_ended')`→`The host has ended the call.`; `onRoomEnded('grace_expired')`→`The host has disconnected and the call has ended.`; `onRemoved()`→`You were removed from the call by the host.`; host `onEndCall`→`endCall` called + navigate `/`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — extend `View`, add the render branches (import the new screens), wire the CallShell callbacks, and map `getRoomStatus === 'ended'`. Keep the M3 SocketProvider wrapper around the in-call subtree (CallShell needs `useSocket` via `useRoomLifecycle`).
- [ ] **Step 4: Run** `npx vitest run src/pages/RoomPage.test.tsx` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): RoomPage wires end/leave/remove/grace-expired/ended screens"`.

---

### Task 18: Full-stack gate + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Backend gate** — `cd backend && npm run typecheck && npm run lint && npm test` → clean/PASS.
- [ ] **Step 2: Frontend gate** — `cd frontend && npm run typecheck && npm run lint && npm test` → clean/PASS (`typecheck` = `tsc -b`).
- [ ] **Step 3: Manual Docker smoke** — `docker compose up --build`, then in a browser:
  1. Host starts a call, a guest joins via the participant link → both tiles.
  2. Host hovers a guest tile → `Remove` → dialog `Remove <name> from the call?` → confirm → guest sees `You were removed from the call by the host.`; host's grid re-arranges; slot frees.
  3. Guest (rejoined) clicks `Leave` → `You have left the call.` + `Rejoin` returns to pre-join.
  4. Kill the host tab (unexpected disconnect) → each guest sees the overlay `The host lost connection. Waiting for them to return...` + `Reconnecting... Ns`. Reopen the host URL within 60s and enter → overlay clears, call resumes.
  5. Repeat (4) but wait >60s → guests see `The host has disconnected and the call has ended.`; revisiting the participant URL shows `This call has ended.`
  6. Host clicks `End call` → host lands on `/`; guest sees `The host has ended the call.`; revisiting the link shows `This call has ended.`
  > LiveKit webhooks must be configured to POST to `http://backend:3000/webhooks/livekit` in `livekit.yaml`/compose for the grace path (4/5) to fire — verify/add this as part of the smoke.
- [ ] **Step 4:** Commit any smoke fixes, then follow `superpowers:finishing-a-development-branch`.

---

## Self-Review

**Spec coverage (M4):**
- FR-3 / US-12 (end call → destroy, guests G5, revisit S2) → Tasks 8 (`end`, `markEnded`, `emitRoomEnded`), 11 (`endCall`), 17 (navigate + `host-ended`).
- FR-4 / US-14 (60s grace: overlay + countdown, resume or destroy) → Tasks 4 (grace controller), 7 (webhook trigger), 8 (join cancels grace, reserved slot), 5/11 (`grace_tick`/`grace_cancelled`/`room_ended`), 12 (store), 14 (overlay), 16 (hook), 17 (grace-expired screen).
- FR-6 / US-13 (remove-guest: tile control + modal + kick + G4) → Tasks 2 (`removeParticipant`), 8 (`remove` endpoint + `emitParticipantRemoved`), 11 (`removeParticipant` client), 15 (dialog + tile control), 16 (wiring), 17 (`removed` view).
- FR-19 (End call red/host-only/≥24px; Leave guest-only) → Task 16 (ControlsBar `ml-6` + `bg-danger`, role gate).
- FR-20 (tooltips) → Tasks 10 (strings), 15/16 (`Tooltip` on remove + end).
- US-11 (Leave → G3 + Rejoin) → Tasks 13 (`GuestLeftScreen`), 17 (leave→`left`, rejoin→prejoin).
- §7 screens S2/G3/G4/G5/G6 → Tasks 13 + 14 (+17 grace-expired).
- ENDED status on revisit → Tasks 1 (`markEnded`), 3 (`ENDED` 410), 8 (`getStatus`/`join`), 11 (`getRoomStatus` 410→ended), 17.
- Security: host actions re-verify `hostToken` (Task 8); webhook signature-verified (Task 7); grace uses server timers only (Task 4).

**Type consistency:** `RoomEndReason` ('host_ended'|'grace_expired') identical in backend socket (Task 5), FE socketEvents (Task 11), `useRoomLifecycle`/RoomPage (16/17). `RoomStatus` gains `'ended'` on both ends (Tasks 1/11). Socket event names/payloads mirrored FE↔BE (Tasks 5/11). Grace deps (`onTick`/`onCancelled`/`onEnded`) wired to the socket broadcasters in `server.ts` (Task 9).

**Deferred follow-ups (call out to the executor / user):**
- Idle-room/ended-marker TTL reaper (spec §8, ~1h) — ⚑ not built here; registry grows in memory (same as M3).
- `Button` `danger` variant — the red End-call/Remove buttons are bare `<button>`s with `bg-danger`; extract a variant in a cleanup pass.
- Screen-share force-clear on grace (spec §3.6) — only relevant once M6 (screen share) exists; no-op until then.
- Reserved-slot capacity (Task 8, D8) assumes LiveKit doesn't count the disconnected host; verify against real LiveKit behavior during the smoke.

**Placeholder scan:** every task carries concrete code/tests + commands. The only intentionally SDK-verify points (flagged inline): `WebhookReceiver`/`WebhookEvent` field names (Task 7) and the `server.ts` io/app wiring order (Task 9).

---

**⚑ Decisions to confirm before execution (my recommended defaults are in the plan; override if you disagree):**
1. **Ended-room reaper deferred** (D4) — M4 keeps ended rooms in memory forever (fine for local single-node; matches M3's unbounded registry). Confirm OK to defer.
2. **Grace-cancel via the `join` endpoint** (D3), not a `participant_joined` webhook — simpler and race-free. Confirm.
3. **`GRACE_TIMEOUT_SECONDS` env** (Task 6) exists mainly for fast tests; production stays 60. Confirm you want it configurable vs. a hard constant.

**Plan complete and saved to `docs/superpowers/plans/2026-07-01-m4-host-lifecycle.md`.** I did not modify any existing/code files — only created this new plan document (safe alongside the background review-fix agent).

**Execution options (when you're ready — after the background review-fix work lands and M3 is merged, since M4 depends on M3):**
1. **Subagent-Driven (recommended)** — fresh subagent per task + task review + final whole-branch review (our default).
2. **Inline Execution** — via executing-plans with checkpoints.

Which approach — and should I first adjust anything per the three ⚑ decisions above?
