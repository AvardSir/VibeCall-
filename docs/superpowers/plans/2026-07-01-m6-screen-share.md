# M6 — Screen Share — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any participant share their screen — one sharer at a time (server-arbitrated) — with the shared content filling a labeled main area (`contain` fit) and the camera tiles collapsing into a thumbnail strip, plus Stop-sharing, busy-blocking, and error/auto-dismiss handling.

**Architecture:** One-sharer arbitration is **server-authoritative over Socket.IO**. The client emits `claim_share`; the backend registry grants only if `activeSharerId` is null/self (`share_granted` to the caller + `share_state` broadcast to the room) or denies (`share_denied { reason: 'busy' }`). Only after a grant does the client open the browser picker via LiveKit `setScreenShareEnabled(true)`. Stopping (button, browser share-bar, or leaving) releases the slot. The frontend reads `activeSharerId` from `useParticipantsStore` to switch `CallShell` between the M2 grid and a `ScreenShareView` + thumbnail strip. LiveKit tokens already permit screen-share publishing — no token change.

**Tech Stack:** Backend — Node 22 + TypeScript (strict, ESM), Socket.IO 4, Vitest. Frontend — React 19 + TypeScript, `@livekit/components-react` 2.9.x / `livekit-client` 2.20.x (`useTracks([Track.Source.ScreenShare])`, `useLocalParticipant().setScreenShareEnabled`, `RoomEvent.LocalTrackUnpublished`), Zustand, react-i18next, Vitest + Testing Library.

## Global Constraints

- **PRD is binding** (`prd-kmb-video-chat.md`). Builds on **M2** (adaptive video grid, `VideoTile`, camera-off/mute tiles). Screen share is FR-16 / US-8, v1.0.
- **Any participant may share** (host and guests) — no role restriction.
- **One sharer at a time, server-arbitrated.** A second requester while someone shares is **blocked** (`share_denied { reason: 'busy' }`) — never a take-over. First `claim_share` to reach the server wins.
- **Verbatim UI strings (EN)** — copy EXACTLY (RU parallel required for each; parity is enforced by the i18n keys test):
  - Share button label: `Share screen` · idle tooltip: `Share your screen`
  - Active tooltip / stop label: `Stop sharing`
  - Busy tooltip + busy inline error: `Someone is already sharing their screen`
  - Main-area label (others): `{{name}} is sharing their screen` · (sharer): `You are sharing your screen`
  - Capture error (auto-dismiss 4s): `Unable to share your screen. Please check your browser permissions.`
- **Layout while sharing:** shared content fills the main area with **`object-contain`** (never cropped) + a persistent label; every camera tile (including the sharer's own) moves to a **horizontal thumbnail strip** using **`object-cover`**, keeping name + camera-off (centered mic-state icon) + muted-mic corner indicator, ordered host-first then join order (same as the grid). The `Waiting for someone to join…` notice stays visible over the share layout when alone. Chat-panel-open shrinks the main area (same as the grid).
- **Controls:** the Share button becomes Stop-sharing for the active sharer; it is **disabled (not hidden)** with the busy tooltip for everyone else. Errors show in an inline area above the controls bar and **auto-dismiss after 4 seconds**.
- **No screen-share audio** (Non-Goal §9.6) — do not pass `{ audio: true }`.
- **Tokens unchanged:** guest+host tokens already grant `canPublish: true` (no `canPublishSources` restriction) → screen share is permitted. Do NOT modify `livekitTokens.ts`.
- **Code rules:** no `any`/`console.log` (use `logger`)/inline `eslint-disable`/`@ts-ignore`, no hardcoded user-facing strings (i18n only), `PascalCase` types no `I`-prefix, string-literal unions, named exports, `import type`. Backend `npm run typecheck && npm run lint && npm test` and frontend `npm run typecheck` (**= `tsc -b`**) `&& npm run lint && npm test` stay clean. Tests co-located. **Socket event maps are duplicated FE↔BE** — add to BOTH identically.

## Coordination with M4 / M5 (read before executing)

M6 shares files with M4 and M5: `socket.ts` (events/deps), `rooms.ts`, `server.ts`, `shared/lib/socketEvents.ts`, `stores/useParticipantsStore.ts` is M6-only but `ControlsBar.tsx` is shared with M4, and the i18n `call` namespace is shared.
- **Resolved (2026-07-01): M4 is present on this branch, and M5's backend token work has landed** (`recordMemberToken`/`verifyMemberToken` + join-response `memberToken`, commits `789608b`/`a4b3cc6`). So `webhooks.ts`, `grace.ts`, room `status`/`graceEndsAt`, and `memberTokens` all already exist in the tree — build directly on the current code. The "if M4 isn't merged" fallback below is retained only as a safety note; it should not trigger.
- **Dependency on M4:** M6 **retrofits `backend/src/webhooks.ts`** (created by M4) so that when the host enters grace OR the active sharer leaves, the share is force-cleared and `share_state { null }` is broadcast (M4 explicitly deferred this — `2026-07-01-m4-host-lifecycle.md`: "Screen-share force-clear on grace … no-op until M6"). The current `webhooks.ts` already handles `participant_left`→host-grace (`webhooks.ts` `if (room && identity === room.hostIdentity && room.status === 'active') deps.grace.startGrace(...)`); Task 4 extends that same branch. (Fallback, should not trigger: if `webhooks.ts` were absent, Task 4 would add a minimal `participant_left`→`clearShare` handler and note it pending.)
- When rebasing onto M4/M5, **MERGE** the socket event maps, `ChatGatewayDeps`/`AppDeps`, `rooms.ts` fields, and the `call` i18n namespace — never replace. `rooms.ts` gains `activeSharerId` (M6) alongside `status`/`graceEndsAt` (M4) and `memberTokens` (M5). **Socket wiring:** `io` is a **detached** `ChatServer` from `createSocketServer(deps)` (single arg), created before the http server and attached via `buildHttpServer(app, io)` — Task 3 only extends that deps object, it does not change the wiring shape.

---

## Resolved Design Decisions

⚑ = worth a human confirm before execution.

- **D1 — Second sharer is blocked, not a take-over** (spec). `claim_share` → `BUSY` when `activeSharerId` is set to someone else.
- **D2 — Any participant can share** (spec) — button in both host and guest controls.
- **D3 — Server-authoritative arbitration** over Socket.IO; `activeSharerId` in the registry is the arbiter. (The SFU itself doesn't enforce single-share; a malicious client bypassing `claim_share` won't flip other clients' layout since their store still points at the real sharer — accepted for the anonymous trust model.)
- **D4 ⚑ — Claim BEFORE the picker; revert on cancel.** The client emits `claim_share`, waits for `share_granted`, THEN calls `setScreenShareEnabled(true)`. If the picker is cancelled / permission denied (promise rejects, or resolves with no published ScreenShare track), the client emits `release_share` to free the slot and shows the capture error. OS/browser "Stop sharing" is detected via `RoomEvent.LocalTrackUnpublished` for `Track.Source.ScreenShare` → emit `release_share`. (The "resolves-with-no-track" cancel edge is best-effort.)
- **D5 ⚑ — M6 retrofits M4's `webhooks.ts`** to clear the active share on host-grace and on active-sharer-left. Depends on M4 (see Coordination).
- **D6 — `ControlsBar` reads `roomId` from `useConnectionStore.localParticipant`** for `claim_share`/`release_share` (no new prop needed).
- **D7 — `useParticipantsStore` gains `setActiveSharerId`.**
- **D8 — `CallShell` switches inner content** on `activeSharerId !== null` between `<VideoGrid/>` and `<ScreenShareView/> + <ThumbnailStrip/>`; the outer flex wrapper is unchanged.

---

## File Structure

**Backend (`backend/src/`)**
- Modify: `rooms.ts` / `rooms.test.ts` — `activeSharerId`; `claimShare`, `releaseShare`, `clearShare`.
- Modify: `socket.ts` / `socket.test.ts` — `claim_share`/`release_share` handlers; `share_granted`/`share_denied`/`share_state` events; `broadcastShareState` helper; widen `ChatGatewayDeps` with `registry`.
- Modify: `server.ts` — pass `registry` into `createSocketServer`.
- Modify: `webhooks.ts` (from M4) / `webhooks.test.ts` — clear share on host-grace + active-sharer-left; broadcast `share_state { null }`.

**Frontend (`frontend/src/`)**
- Modify: `shared/i18n/en.ts`, `ru.ts`, keys test — share strings.
- Modify: `shared/lib/socketEvents.ts` — mirror the new events.
- Modify: `stores/useParticipantsStore.ts` / test — `setActiveSharerId`.
- Create: `features/call/hooks/useShareState.ts` (+ test) — the single persistent `share_state` → store subscription (mounted once by `CallShell`). The claim/grant bridge lives in `useScreenShare`, not here.
- Create: `features/call/hooks/useScreenShare.ts` (+ test) — `{ isSharing, isBusy, error, toggle }`: internal `requestShare` claim bridge, claim→picker→publish / stop→release, LocalTrackUnpublished detection, 4s error auto-dismiss.
- Create: `features/call/components/ScreenShareView.tsx` (+ test) — contain-fit share track + label.
- Create: `features/call/components/ThumbnailStrip.tsx` (+ test) — horizontal row of `ParticipantTile`s (reuses the M2 tile); accepts `onRemoveGuest` so host-remove works during a share.
- Modify: `features/call/components/VideoGrid.tsx` — extract a shared `ParticipantTile` subcomponent (carrying `onRemoveGuest`) used by both grid + strip; grid keeps its `GRID_LAYOUT`/`centerBottom` cell wrapper.
- Modify: `features/call/components/ControlsBar.tsx` / test — Share/Stop button, busy-disable, tooltips, inline error.
- Modify: `features/call/CallShell.tsx` — layout switch on `activeSharerId`; wire `useShareState`.
- Modify: `features/call/index.ts` — export new components if needed.

---

# Backend

### Task 1: Share arbitration state on the registry

**Files:** Modify `backend/src/rooms.ts`, `rooms.test.ts`.

**Interfaces:**
- Produces: `Room` gains `activeSharerId: string | null` (default `null`). `RoomRegistry` gains `claimShare(roomId, identity): { ok: true } | { ok: false; code: 'BUSY' | 'NOT_FOUND' }` (grants iff `activeSharerId` is null or already `identity`); `releaseShare(roomId, identity): boolean` (clears iff caller is the active sharer; returns whether it changed); `clearShare(roomId): boolean` (unconditional clear; returns whether it changed).

- [ ] **Step 1: Failing tests** — append to `rooms.test.ts`:

```ts
it('grants a share to the first claimant and denies a second, distinct one', () => {
  const registry = createRoomRegistry();
  const room = registry.create();
  expect(registry.claimShare(room.roomId, 'p_1')).toEqual({ ok: true });
  expect(registry.get(room.roomId)?.activeSharerId).toBe('p_1');
  expect(registry.claimShare(room.roomId, 'p_2')).toEqual({ ok: false, code: 'BUSY' });
  expect(registry.claimShare(room.roomId, 'p_1')).toEqual({ ok: true }); // idempotent for the holder
});

it('claimShare on an unknown room returns NOT_FOUND', () => {
  const registry = createRoomRegistry();
  expect(registry.claimShare('ghost', 'p_1')).toEqual({ ok: false, code: 'NOT_FOUND' });
});

it('releaseShare clears only for the active sharer', () => {
  const registry = createRoomRegistry();
  const room = registry.create();
  registry.claimShare(room.roomId, 'p_1');
  expect(registry.releaseShare(room.roomId, 'p_2')).toBe(false); // not the sharer
  expect(registry.get(room.roomId)?.activeSharerId).toBe('p_1');
  expect(registry.releaseShare(room.roomId, 'p_1')).toBe(true);
  expect(registry.get(room.roomId)?.activeSharerId).toBeNull();
});

it('clearShare unconditionally clears and reports whether it changed', () => {
  const registry = createRoomRegistry();
  const room = registry.create();
  registry.claimShare(room.roomId, 'p_1');
  expect(registry.clearShare(room.roomId)).toBe(true);
  expect(registry.get(room.roomId)?.activeSharerId).toBeNull();
  expect(registry.clearShare(room.roomId)).toBe(false); // already clear
});
```

- [ ] **Step 2: Run** `cd backend && npx vitest run src/rooms.test.ts` → FAIL.
- [ ] **Step 3: Implement** — add `activeSharerId: string | null` to `Room` (init `null` in `create`), add the methods to the type + object:

```ts
    claimShare(roomId, identity) {
      const room = rooms.get(roomId);
      if (!room) return { ok: false, code: 'NOT_FOUND' };
      if (room.activeSharerId !== null && room.activeSharerId !== identity) return { ok: false, code: 'BUSY' };
      room.activeSharerId = identity;
      return { ok: true };
    },
    releaseShare(roomId, identity) {
      const room = rooms.get(roomId);
      if (!room || room.activeSharerId !== identity) return false;
      room.activeSharerId = null;
      return true;
    },
    clearShare(roomId) {
      const room = rooms.get(roomId);
      if (!room || room.activeSharerId === null) return false;
      room.activeSharerId = null;
      return true;
    },
```

Update the deterministic-generator `toEqual` test in `rooms.test.ts` to include `activeSharerId: null`. Note this object **already** contains `memberTokens: new Map()` (landed with M5) — add `activeSharerId: null` alongside it (current literal: `{ roomId: 't0', hostToken: 't1', hostIdentity: null, createdAt: 123, status: 'active', graceEndsAt: null, memberTokens: new Map() }`), or switch the assertion to `toMatchObject` of the scalar fields.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): screen-share arbitration state on the registry"` (end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`).

---

### Task 2: Socket share events + handlers

**Files:** Modify `backend/src/socket.ts`, `socket.test.ts`.

**Interfaces:**
- `ClientToServerEvents` gains `claim_share: (p: { roomName: string }) => void`, `release_share: (p: { roomName: string }) => void`.
- `ServerToClientEvents` gains `share_granted: () => void`, `share_denied: (e: { reason: 'busy' }) => void`, `share_state: (s: { activeSharerId: string | null }) => void`.
- `ChatGatewayDeps` gains `registry: Pick<RoomRegistry, 'claimShare' | 'releaseShare'>`.
- Exports `handleClaimShare(socket, io, deps)`, `handleReleaseShare(socket, io, deps)`, and `broadcastShareState(io, roomName, activeSharerId)`. Handlers require a bound socket (`socket.data.binding`); they read `binding.identity`/`binding.roomName`. **MERGE with MR3/M4 additions** — keep typed maps/aliases/guarded listeners; register the two new listeners with the same try/catch guard pattern.

- [ ] **Step 1: Failing tests** — append to `socket.test.ts` (adapt to the file's `makeIo`/bound-socket helpers):

```ts
import { handleClaimShare, handleReleaseShare, broadcastShareState } from './socket.js';

it('grants a share to the first claimant and broadcasts the active sharer', () => {
  const io = makeIo();
  const socket = boundSocket({ identity: 'p_1', displayName: 'Ann', roomName: 'r1' });
  const registry = { claimShare: vi.fn(() => ({ ok: true })), releaseShare: vi.fn() };
  handleClaimShare(socket, io, { ...makeDeps(), registry } as never);
  expect(socket.emitted).toContainEqual(['share_granted']);
  expect(io.to).toHaveBeenCalledWith('r1');
  expect(io.emitted.at(-1)).toEqual(['share_state', { activeSharerId: 'p_1' }]);
});

it('denies a share when busy (no broadcast)', () => {
  const io = makeIo();
  const socket = boundSocket({ identity: 'p_2', displayName: 'Bob', roomName: 'r1' });
  const registry = { claimShare: vi.fn(() => ({ ok: false, code: 'BUSY' })), releaseShare: vi.fn() };
  handleClaimShare(socket, io, { ...makeDeps(), registry } as never);
  expect(socket.emitted).toContainEqual(['share_denied', { reason: 'busy' }]);
});

it('release broadcasts a cleared share only when the caller held it', () => {
  const io = makeIo();
  const socket = boundSocket({ identity: 'p_1', displayName: 'Ann', roomName: 'r1' });
  const registry = { claimShare: vi.fn(), releaseShare: vi.fn(() => true) };
  handleReleaseShare(socket, io, { ...makeDeps(), registry } as never);
  expect(io.emitted.at(-1)).toEqual(['share_state', { activeSharerId: null }]);
});

it('broadcastShareState emits to the room channel', () => {
  const io = makeIo();
  broadcastShareState(io, 'r1', null);
  expect(io.emitted.at(-1)).toEqual(['share_state', { activeSharerId: null }]);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — extend both maps (keep the cross-ref comment), widen `ChatGatewayDeps`, add the helpers + handlers:

```ts
export function broadcastShareState(io: ChatServer, roomName: string, activeSharerId: string | null): void {
  io.to(roomName).emit('share_state', { activeSharerId });
}

export function handleClaimShare(socket: ChatSocket, io: ChatServer, deps: ChatGatewayDeps): void {
  const binding = socket.data.binding;
  if (!binding) { socket.emit('share_denied', { reason: 'busy' }); return; } // unbound → treat as unable
  const result = deps.registry.claimShare(binding.roomName, binding.identity);
  if (result.ok) {
    socket.emit('share_granted');
    broadcastShareState(io, binding.roomName, binding.identity);
  } else {
    socket.emit('share_denied', { reason: 'busy' });
  }
}

export function handleReleaseShare(socket: ChatSocket, io: ChatServer, deps: ChatGatewayDeps): void {
  const binding = socket.data.binding;
  if (!binding) return;
  if (deps.registry.releaseShare(binding.roomName, binding.identity)) {
    broadcastShareState(io, binding.roomName, null);
  }
}
```

In `createSocketServer`, register guarded listeners mirroring the chat ones:

```ts
    socket.on('claim_share', () => { try { handleClaimShare(socket, io, deps); } catch (err: unknown) { logger.error({ err }, 'claim_share handler failed'); } });
    socket.on('release_share', () => { try { handleReleaseShare(socket, io, deps); } catch (err: unknown) { logger.error({ err }, 'release_share handler failed'); } });
```

(The payload `{ roomName }` is present on the event type for symmetry with the FE, but the server trusts `binding.roomName`, not the payload.)

> **Merge note:** widening `ChatGatewayDeps` with a **required** `registry` breaks the *existing* chat-handler tests, which build deps via the `makeDeps()` helper. Update `makeDeps()` in `socket.test.ts` to include a `registry` stub (`{ claimShare: vi.fn(), releaseShare: vi.fn() }`) so `handleJoinChat`/`handleSendMessage` tests still typecheck. (The current `ChatGatewayDeps` is `{ config, admin, chat }` — `registry` is genuinely new here; M5 does **not** add it, so there is nothing to merge, only to extend.)

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(backend): socket screen-share claim/release arbitration + broadcast"`.

---

### Task 3: Pass the registry to the socket server

**Files:** Modify `backend/src/server.ts`.

- [ ] **Step 1: Implement** — add `registry` to the existing socket-server deps object. **`createSocketServer` takes a single deps argument** (it returns a *detached* `io`, constructed before the http server and attached later via `buildHttpServer` — do NOT pass an `httpServer` here). The current call in `server.ts` is `const io: ChatServer = createSocketServer({ config, admin, chat });` — change it to:

```ts
  const io: ChatServer = createSocketServer({ config, admin, chat, registry });
```

(The `registry` is already constructed above this line in `server.ts`; this just threads it into the gateway deps so the share handlers can arbitrate.)

- [ ] **Step 2: Backend typecheck** — `cd backend && npm run typecheck` → clean (confirms `ChatGatewayDeps` now requires `registry` and it's supplied at the one construction site). **NB:** because Task 2 makes `registry` a **required** field on `ChatGatewayDeps`, the `makeDeps()` helper in `socket.test.ts` must also gain a `registry` (a `claimShare`/`releaseShare` stub) or the existing chat-handler tests won't typecheck — see Task 2 Step 3.
- [ ] **Step 3: Commit** — `git commit -m "refactor(backend): supply registry to the socket gateway for share arbitration"`.

---

### Task 4: Force-clear share on host-grace + sharer-left (retrofit M4 webhooks)

**Files:** Modify `backend/src/webhooks.ts`, `webhooks.test.ts` (both created by M4).

> **Depends on M4.** If `webhooks.ts` does not yet exist, defer this task until M4 lands and note it in the ledger; the FE still works (a stale `activeSharerId` only lingers until the room ends). Do NOT create M4's grace machinery here.

**Interfaces:** the webhook handler gains `registry.clearShare` + a `broadcastShareState` callback (via injected deps). On `participant_left`: (a) if the leaver is the **active sharer**, `registry.clearShare(roomName)` + broadcast `share_state { null }`; (b) the existing host-left→grace path additionally force-clears any active share before/with starting grace. `WebhookDeps` widens with `registry: Pick<RoomRegistry,'get'|'clearShare'>` and `onShareCleared(roomName): void` (wired to `broadcastShareState(io, roomName, null)`).

- [ ] **Step 1: Failing tests** — add to `webhooks.test.ts`:

```ts
it('clears the share when the active sharer leaves', async () => {
  const clearShare = vi.fn(() => true);
  const onShareCleared = vi.fn();
  const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_sharer' } }) };
  const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active', activeSharerId: 'p_sharer' })), clearShare };
  const handler = createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace: { startGrace: vi.fn() }, onShareCleared });
  await handler(req('{}'), res(), vi.fn());
  expect(clearShare).toHaveBeenCalledWith('r1');
  expect(onShareCleared).toHaveBeenCalledWith('r1');
});

it('force-clears the share when the host enters grace', async () => {
  const clearShare = vi.fn(() => true);
  const onShareCleared = vi.fn();
  const startGrace = vi.fn();
  const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_host' } }) };
  const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active', activeSharerId: 'p_host' })), clearShare };
  await createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace: { startGrace }, onShareCleared })(req('{}'), res(), vi.fn());
  expect(startGrace).toHaveBeenCalledWith('r1');
  expect(clearShare).toHaveBeenCalledWith('r1');
  expect(onShareCleared).toHaveBeenCalledWith('r1');
});
```

(Reuse the `req`/`res` helpers from M4's `webhooks.test.ts`.)

- [ ] **Step 2: Run** `npx vitest run src/webhooks.test.ts` → FAIL.
- [ ] **Step 3: Implement** — widen `WebhookDeps` with `registry: Pick<RoomRegistry,'get'|'clearShare'>` and `onShareCleared: (roomName: string) => void`; in the `participant_left` branch, after resolving `room`:

```ts
    if (room && room.activeSharerId === identity) {
      if (deps.registry.clearShare(room.roomId)) deps.onShareCleared(room.roomId);
    }
    if (room && identity === room.hostIdentity && room.status === 'active') {
      if (deps.registry.clearShare(room.roomId)) deps.onShareCleared(room.roomId); // grace force-clears any share
      deps.grace.startGrace(room.roomId);
    }
```

Wire `onShareCleared` in `server.ts`: `onShareCleared: (roomName) => broadcastShareState(io, roomName, null)`.

- [ ] **Step 4: Run** → PASS. **Step 5: Backend gate** — `cd backend && npm run typecheck && npm run lint && npm test` → clean/PASS. **Step 6: Commit** — `git commit -m "feat(backend): force-clear active share on sharer-left and host-grace"`.

---

# Frontend

### Task 5: i18n share strings

**Files:** Modify `frontend/src/shared/i18n/en.ts`, `ru.ts`, keys test.

**Interfaces:** `call` gains `shareScreen`, `shareTooltipIdle`, `shareTooltipActive`, `shareTooltipBusy`, `stopSharing`, `sharingLabel`, `youAreSharing`, `shareError`, `shareBusy`.

- [ ] **Step 1: Parity test (red)**:

```ts
it('exposes M6 screen-share call keys with parity', () => {
  for (const k of ['shareScreen','shareTooltipIdle','shareTooltipActive','shareTooltipBusy','stopSharing','sharingLabel','youAreSharing','shareError','shareBusy'])
    expect(en.call).toHaveProperty(k);
  expect(Object.keys(ru.call)).toEqual(Object.keys(en.call));
  expect(en.call.sharingLabel).toBe('{{name}} is sharing their screen');
  expect(en.call.shareError).toBe('Unable to share your screen. Please check your browser permissions.');
});
```

- [ ] **Step 2: Run** `npx vitest run src/shared/i18n` → FAIL.
- [ ] **Step 3: Add EN** (into `call`):

```ts
    shareScreen: 'Share screen',
    shareTooltipIdle: 'Share your screen',
    shareTooltipActive: 'Stop sharing',
    shareTooltipBusy: 'Someone is already sharing their screen',
    stopSharing: 'Stop sharing',
    sharingLabel: '{{name}} is sharing their screen',
    youAreSharing: 'You are sharing your screen',
    shareError: 'Unable to share your screen. Please check your browser permissions.',
    shareBusy: 'Someone is already sharing their screen',
```

- [ ] **Step 4: Add RU** (mirror keys):

```ts
    shareScreen: 'Демонстрация экрана',
    shareTooltipIdle: 'Показать свой экран',
    shareTooltipActive: 'Остановить показ',
    shareTooltipBusy: 'Кто-то уже показывает экран',
    stopSharing: 'Остановить показ',
    sharingLabel: '{{name}} показывает экран',
    youAreSharing: 'Вы показываете свой экран',
    shareError: 'Не удалось показать экран. Проверьте разрешения браузера.',
    shareBusy: 'Кто-то уже показывает экран',
```

- [ ] **Step 5: Run** `npx vitest run src/shared/i18n && npm run typecheck` → PASS/clean. **Step 6: Commit** — `git commit -m "feat(frontend): i18n for screen share (EN/RU)"`.

---

### Task 6: Socket events mirror + store setter

**Files:** Modify `frontend/src/shared/lib/socketEvents.ts`, `stores/useParticipantsStore.ts`, `useParticipantsStore.test.ts`.

**Interfaces:** `socketEvents.ts` mirrors backend Task 2 (`share_granted`/`share_denied`/`share_state` in `ServerToClientEvents`; `claim_share`/`release_share` in `ClientToServerEvents`). `useParticipantsStore` gains `setActiveSharerId(id: string | null): void`.

- [ ] **Step 1: Store test (red)**:

```ts
it('sets and clears the active sharer', () => {
  useParticipantsStore.getState().setActiveSharerId('p_1');
  expect(useParticipantsStore.getState().activeSharerId).toBe('p_1');
  useParticipantsStore.getState().setActiveSharerId(null);
  expect(useParticipantsStore.getState().activeSharerId).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run src/stores/useParticipantsStore.test.ts` → FAIL.
- [ ] **Step 3: Implement** — add `setActiveSharerId: (id) => set({ activeSharerId: id })` to the store and add its signature to the state type. **Note:** `activeSharerId: string | null` already exists in `useParticipantsStore` as an M2 forward-compat stub (init `null`, and already cleared by `reset()`), so only the **setter** is new — do not re-declare the field or re-add it to `reset()`. Add the five events to `socketEvents.ts` (mirror backend Task 2, keep the cross-ref comment; `send_message` there already carries M5's `attachments?` — leave it).
- [ ] **Step 4: Run** `npx vitest run src/stores && npm run typecheck` → PASS/clean. **Step 5: Commit** — `git commit -m "feat(frontend): share socket events + setActiveSharerId"`.

---

### Task 7: `useShareState` hook (socket → store subscription, mounted once)

**Files:** Create `frontend/src/features/call/hooks/useShareState.ts`, `useShareState.test.ts`.

> **Design (gap fix):** this hook owns **only** the persistent `share_state` → store subscription and is mounted **exactly once** (by `CallShell`, Task 12). The transient claim/grant bridge (`requestShare`) is **not** here — it lives inside `useScreenShare` (Task 8), which is the only consumer that claims. Keeping the bridge out of this hook avoids a **double `share_state` subscription** (the earlier design had both `CallShell` and `useScreenShare` mount `useShareState`, registering the listener twice).

**Interfaces:** `useShareState(): void`. Subscribes (via `useSocket()`) to `share_state` → `setActiveSharerId`; off the exact handler on cleanup. No return value.

- [ ] **Step 1: Test (red)** — mock `useSocket` capturing handlers; render the hook; invoke the captured `share_state` handler and assert `useParticipantsStore.getState().activeSharerId` updates; assert `socket.off('share_state', …)` runs on unmount.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**:

```ts
import { useEffect } from 'react';
import { useSocket } from '../../../shared/lib/SocketProvider';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';

export function useShareState(): void {
  const socket = useSocket();
  const setActiveSharerId = useParticipantsStore((s) => s.setActiveSharerId);
  useEffect(() => {
    const onState = (s: { activeSharerId: string | null }): void => setActiveSharerId(s.activeSharerId);
    socket.on('share_state', onState);
    return () => { socket.off('share_state', onState); };
  }, [socket, setActiveSharerId]);
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): useShareState — single share_state subscription into the store"`.

---

### Task 8: `useScreenShare` hook (picker + publish + errors)

**Files:** Create `frontend/src/features/call/hooks/useScreenShare.ts`, `useScreenShare.test.ts`.

**Interfaces:** `useScreenShare(): { isSharing: boolean; isBusy: boolean; error: string | null; toggle: () => void }`. Uses `useLocalParticipant()`, `useSocket()`, `useConnectionStore` (`localParticipant.roomId` + `.identity`), `useParticipantsStore(activeSharerId)`. `isSharing = activeSharerId === localIdentity`; `isBusy = activeSharerId !== null && activeSharerId !== localIdentity`. `toggle()`: if sharing → `setScreenShareEnabled(false)` + emit `release_share`; else if not busy → `await requestShare()`; on `'granted'` → `try setScreenShareEnabled(true) catch → release_share + set error (call.shareError)`; on `'busy'` → set error (call.shareBusy). Errors auto-dismiss after 4s. Also listens for `RoomEvent.LocalTrackUnpublished` (source ScreenShare) while sharing → emit `release_share`.

> **Owns the claim bridge (gap fix).** `requestShare` is an **internal** function of this hook (not `useShareState`), so the transient `share_granted`/`share_denied` listeners are only ever registered by the one component that claims. `useShareState` (Task 7) keeps the *persistent* `share_state` subscription. Internal bridge:
>
> ```ts
> function requestShare(): Promise<'granted' | 'busy'> {
>   return new Promise((resolve) => {
>     const onGranted = (): void => { cleanup(); resolve('granted'); };
>     const onDenied = (): void => { cleanup(); resolve('busy'); };
>     const timer = setTimeout(() => { cleanup(); resolve('busy'); }, 5000);
>     function cleanup(): void { clearTimeout(timer); socket.off('share_granted', onGranted); socket.off('share_denied', onDenied); }
>     socket.on('share_granted', onGranted);
>     socket.on('share_denied', onDenied);
>     socket.emit('claim_share', { roomName: roomId });
>   });
> }
> ```

- [ ] **Step 1: Test (red)** — mock `useLocalParticipant` (`setScreenShareEnabled` spy), `useSocket` (capturing `emit` + on/off so the test can invoke the captured `share_granted`/`share_denied` handler), `useConnectionStore`/`useParticipantsStore`. Cases: idle + `claim_share` emitted then granted → `setScreenShareEnabled(true)` called; grant but `setScreenShareEnabled` rejects → `release_share` emitted + `error === shareError`; busy (`activeSharerId` is someone else) → `error === shareBusy`, `claim_share` **not** emitted, picker not opened; sharing + toggle → `setScreenShareEnabled(false)` + `release_share`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the hook per the interface, including the internal `requestShare` above. Use `useTranslation('call')` for the error strings; a `useRef` timer for the 4s auto-dismiss (cleared on unmount / on the next error). Guard `setScreenShareEnabled(true)` in try/catch; on catch emit `release_share` and set `t('shareError')`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): useScreenShare — picker, publish, release, error auto-dismiss"`.

---

### Task 9: `ScreenShareView` (main area)

**Files:** Create `frontend/src/features/call/components/ScreenShareView.tsx`, test.

**Interfaces:** `ScreenShareView` — no props; reads the screen-share `TrackReference` via `useTracks([Track.Source.ScreenShare])` (picks the one whose `participant.identity === activeSharerId`), the sharer's display name from `useParticipantsStore.participants`, and the local identity. Renders `<VideoTrack trackRef=... className="max-h-full max-w-full object-contain" />` centered, with a label: `activeSharerId === localIdentity ? t('youAreSharing') : t('sharingLabel', { name })`.

- [ ] **Step 1: Test (red)** — mock `useTracks` to return a ScreenShare `TrackReference` for `p_1`; seed the store (`activeSharerId: 'p_1'`, a participant named `Ann`); assert the label reads `Ann is sharing their screen`. With local identity === activeSharerId, assert `You are sharing your screen`. (Mock `@livekit/components-react`'s `VideoTrack`/`useTracks` as the existing VideoGrid tests do.)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — mirror `VideoGrid`'s `useTracks` usage; `object-contain` on the video; label overlaid (e.g. a `Text` at the top). If no matching track yet (publish in flight), render a neutral placeholder with the label.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): ScreenShareView (contain-fit shared content + label)"`.

---

### Task 10: `ThumbnailStrip` (reuse VideoTile)

**Files:** Create `frontend/src/features/call/components/ThumbnailStrip.tsx`, test; modify `VideoGrid.tsx` to extract the shared per-participant tile mapping.

**Interfaces:** Extract the per-participant tile from `VideoGrid` into a shared `ParticipantTile` subcomponent so both the grid and the strip render identical tiles (same name/camera-off/mute logic, host-first order, **and the host remove control**). Its props mirror what the current `VideoGrid` mapping feeds each `VideoTile`: `{ participant: CallParticipant; trackRef?: TrackReference; onRemoveGuest?: (identity: string, name: string) => void }` — it renders `<VideoTile … onRemove={!participant.isLocal && onRemoveGuest ? () => onRemoveGuest(participant.identity, participant.name) : undefined} />`. **Grid-specific layout stays in `VideoGrid`** (the `centerBottom`/`col-span` cell wrapper and `GRID_LAYOUT` are NOT moved into `ParticipantTile`). `ThumbnailStrip` props: `{ onRemoveGuest?: (identity: string, name: string) => void }`; it reads `participants` + `useTracks([Track.Source.Camera])` itself (like `VideoGrid`) and renders each participant through `ParticipantTile` in a horizontal, fixed-height, scrollable row (`flex gap-2 overflow-x-auto`), each tile at thumbnail size with `object-cover`.

> **Gap fix — do not drop host-remove during a share.** The current `VideoGrid` threads `onRemoveGuest` into each tile (`VideoGrid.tsx` → `VideoTile onRemove=…`), which is how a host removes a guest (M3/M4). The strip MUST forward the same `onRemoveGuest` (Task 12 passes it), or a host silently loses the ability to remove a guest while anyone is screen-sharing — a regression. `ParticipantTile` carrying `onRemoveGuest` keeps grid and strip identical.

- [ ] **Step 1: Test (red)** — seed `useParticipantsStore.participants` with two participants + mock `useTracks([Track.Source.Camera])`; render `<ThumbnailStrip onRemoveGuest={spy} />`; assert both names render and the container is a horizontal flex row (query by a testid or role); assert a camera-off participant shows the mic-state icon (reuse VideoTile's existing behavior); assert a **remote** tile exposes the remove control and clicking it calls the `onRemoveGuest` spy with that participant's identity+name, while the **local** tile has no remove control.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — extract `ParticipantTile` (used by both); refactor `VideoGrid` to map participants → its grid cell wrapping `<ParticipantTile … onRemoveGuest={onRemoveGuest} />` (behavior-preserving — keep `GRID_LAYOUT`, `centerBottom`, and the `count === 1` `Waiting…` notice unchanged); `ThumbnailStrip` maps participants → `<ParticipantTile … onRemoveGuest={onRemoveGuest} />` in the horizontal row. Do not alter `VideoTile`.
- [ ] **Step 4: Run** `npx vitest run src/features/call` → PASS (VideoGrid tests still green after the extraction). **Step 5: Commit** — `git commit -m "feat(frontend): ThumbnailStrip reusing the participant tiles"`.

---

### Task 11: ControlsBar — Share/Stop button

**Files:** Modify `frontend/src/features/call/components/ControlsBar.tsx`, `ControlsBar.test.tsx`.

**Interfaces:** ControlsBar calls `useScreenShare()` and renders a Share button between the camera toggle and the chat button: label `t('shareScreen')` / when `isSharing` → `t('stopSharing')`; tooltip `isBusy ? shareTooltipBusy : isSharing ? shareTooltipActive : shareTooltipIdle`; `disabled={isBusy}`; `onClick={toggle}`. When `error` is set, render it in the inline area above the controls (`text-sm text-amber-400`, matching the existing error style). Wrap the trigger in the shared `Tooltip` (never native `title`). No new props (reads roomId via the store inside `useScreenShare`).

- [ ] **Step 1: Tests (red)** — mock `useScreenShare` to return controllable `{ isSharing, isBusy, error, toggle }`. Assert: idle → button labeled `Share screen`, enabled, tooltip `Share your screen`; `isSharing: true` → labeled `Stop sharing`; `isBusy: true` → disabled + tooltip `Someone is already sharing their screen`; `error` set → the message renders; clicking calls `toggle`.
- [ ] **Step 2: Run** `npx vitest run src/features/call/components/ControlsBar.test.tsx` → FAIL.
- [ ] **Step 3: Implement** — add the button + inline error; keep mic/cam/chat/copy-link/leave(or end, from M4) intact; preserve the ≥24px gap before End call (M4). If ControlsBar currently has no error slot, add a small `{error ? <p className="text-sm text-amber-400">{error}</p> : null}` above the row.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** — `git commit -m "feat(frontend): Share/Stop control with busy-disable + inline error"`.

---

### Task 12: CallShell layout switch + wiring

**Files:** Modify `frontend/src/features/call/CallShell.tsx`, `features/call/index.ts`.

**Interfaces:** `CallShell` reads `activeSharerId` from `useParticipantsStore` and calls `useShareState()` **once** (the sole `share_state` subscription; Task 7). When `activeSharerId !== null`, the main content renders `<ScreenShareView />` (flex-1) above `<ThumbnailStrip … />` (fixed height); otherwise `<VideoGrid … />` as today. **Host-remove:** `CallShell` already builds the host-only remove callback it passes to `VideoGrid` (`role === 'host' ? (identity, name) => setRemoveTarget({ identity, name }) : undefined`) — hoist it to a `const onRemoveGuest = …` and pass the **same** value to both `<VideoGrid onRemoveGuest={onRemoveGuest} />` and `<ThumbnailStrip onRemoveGuest={onRemoveGuest} />`, so removing a guest works identically in grid and share layouts (gap fix, Task 10). The `Waiting for someone to join…` empty state remains visible over the share layout when the participant count is 1 (reuse the existing overlay, or render it in `ScreenShareView`'s placeholder). `useScreenShare` is consumed inside `ControlsBar` (Task 11), so `CallShell` only needs `useShareState` for the subscription + the layout branch.

- [ ] **Step 1: Test (red)** — `CallShell` has no test today; add a focused one OR verify via an integration render: mock `useParticipantsStore` with `activeSharerId: 'p_1'` and assert `ScreenShareView`'s label renders (and the grid does not); with `activeSharerId: null` assert the grid renders. Mock LiveKit hooks + `useShareState` as needed. If a full CallShell render is too heavy, extract the layout choice into a tiny presentational `CallStage` component and test that instead.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — the conditional layout + `useShareState()` call. Keep `LiveKitRoom`, `RoomAudioRenderer`, `ControlsBar`, and the M4 grace overlay / dialogs intact. Export `ScreenShareView`/`ThumbnailStrip` from `features/call/index.ts` if imported across the feature boundary.
- [ ] **Step 4: Run** `npx vitest run src/features/call` → PASS. **Step 5: Frontend gate** — `cd frontend && npm run typecheck && npm run lint && npm test` → clean/PASS. **Step 6: Commit** — `git commit -m "feat(frontend): CallShell switches to share layout on active sharer"`.

---

### Task 13: Full-stack gate + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Backend gate** — `cd backend && npm run typecheck && npm run lint && npm test` → clean/PASS.
- [ ] **Step 2: Frontend gate** — `cd frontend && npm run typecheck && npm run lint && npm test` → clean/PASS.
- [ ] **Step 3: Manual Docker smoke** — `docker compose up --build`, two participants (A host, B guest) in a room:
  1. A clicks **Share screen** → browser picker → pick a window → A and B both see the shared content in a `contain` main area labeled `You are sharing your screen` (A) / `<A> is sharing their screen` (B); all camera tiles move to the thumbnail strip; A's camera keeps transmitting in the strip.
  2. B's **Share screen** button is **disabled** with tooltip `Someone is already sharing their screen`.
  3. A clicks **Stop sharing** → both return to the grid; B's button re-enables.
  4. A shares again, then clicks the browser's native "Stop sharing" bar → both return to the grid (LocalTrackUnpublished → release).
  5. A shares, then A **leaves / is removed** → B returns to the grid (webhook `clearShare` + `share_state {null}`).
  6. A opens the picker and **cancels** it → no share starts, inline `Unable to share your screen. Please check your browser permissions.` shows for ~4s, then dismisses; the server slot is freed (B can share).
  7. (If M4 present) A shares, then A (host) is killed unexpectedly → the share force-clears and the grace overlay appears for B.
  8. Open the chat panel during a share → the main area shrinks to the remaining width.
  > LiveKit webhooks must be configured to POST to the backend for (5)/(7). Verify screen-share publishing works with the existing token (no `canPublishSources` change needed).
- [ ] **Step 4:** Commit any smoke fixes, then follow `superpowers:finishing-a-development-branch`.

---

## Self-Review

**Spec coverage (M6):**
- FR-16 / US-8 (any participant shares; one-sharer arbitration; blocked concurrent; stop; sharer-departs) → Tasks 1 (registry claim/release/clear), 2 (socket handlers), 4 (sharer-left/grace clear), 7/8 (client claim→picker→publish/stop), 11 (button + busy-disable).
- Layout (contain main area + label; tiles → cover thumbnail strip; sharer included; waiting overlay; chat-shrink) → Tasks 9 (ScreenShareView), 10 (ThumbnailStrip), 12 (CallShell switch).
- Controls + errors (Share/Stop, busy tooltip, capture error 4s auto-dismiss, share-busy) → Tasks 5 (strings), 8 (error handling + dismiss), 11 (render).
- Server-authoritative arbitration → Tasks 1–3. Grace/left force-clear → Task 4. Token already permits share → no token task (Global Constraints).

**Type consistency:** the five socket events are identical FE (`socketEvents.ts`, Task 6) ↔ BE (`socket.ts`, Task 2). `activeSharerId: string | null` consistent across registry (1), `share_state` payload (2/6), store (6), and the layout switch (12). The `share_state` subscription is owned once by `useShareState` (7, mounted in `CallShell` 12); the internal `requestShare(): Promise<'granted'|'busy'>` bridge lives in `useScreenShare` (8), consumed by `ControlsBar` (11). `onRemoveGuest` flows `CallShell` (12) → `VideoGrid`/`ThumbnailStrip` → shared `ParticipantTile` (10), so host-remove is identical in grid and share layouts.

**Deferred / flagged:**
- **⚑ D4** — picker-cancel that *resolves with no track* (rather than rejecting) is a best-effort case; the `LocalTrackUnpublished` listener + the try/catch cover the common paths. QA the exact browser behavior.
- **⚑ D5** — Task 4 depends on M4's `webhooks.ts`; if M4 isn't merged, defer Task 4 (stale `activeSharerId` only until room end).
- Waiting-overlay exact positioning over the share layout (Task 12) is best-effort per the spec ("stays visible").
- No screen-share audio (Non-Goal §9.6).

**Placeholder scan:** every task carries concrete code/tests + commands. LiveKit-verify points (flagged inline): `setScreenShareEnabled` cancel-vs-reject behavior and the `RoomEvent.LocalTrackUnpublished` source filter (Task 8), and `useTracks([Track.Source.ScreenShare])` reference selection (Task 9) — verify against `@livekit/components-react` 2.9.x during Tasks 8–9.

---

**⚑ Decisions to confirm before execution:**
1. **Order vs. M4** — Task 4 retrofits M4's `webhooks.ts`. Recommend M4 → M6. If M6 runs first, Task 4 is deferred. Confirm order.
2. **Claim-before-picker** (D4) with `release_share` on cancel — confirm (vs. opening the picker first, then claiming).
3. **VideoGrid refactor** (Task 10) extracts a shared tile-mapping used by grid + strip — confirm you're OK touching `VideoGrid` (M2 code) for the extraction (kept behavior-preserving + tested).

**Plan complete and saved to `docs/superpowers/plans/2026-07-01-m6-screen-share.md`.** I did not modify any existing/code files — only created this new plan document (safe alongside the running background agent).

**Execution options (when ready):**
1. **Subagent-Driven (recommended)** — fresh subagent per task + task review + final whole-branch review.
2. **Inline Execution** — via executing-plans with checkpoints.

Which approach — and how do you want to resolve the three ⚑ decisions (especially M4→M6 ordering)?
