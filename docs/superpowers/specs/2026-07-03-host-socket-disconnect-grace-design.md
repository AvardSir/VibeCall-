# Host socket-disconnect → grace flow (design)

**Date:** 2026-07-03
**Status:** Approved (design), pending implementation plan
**Related:** PRD US-14 / FR-4 (host reconnect), technical design §3.3 (host-reconnect grace)

## Problem

When the host closes their tab (or otherwise drops), guests do **not** see the required
host-grace overlay (`"The host lost connection. Waiting for them to return..." / "Reconnecting... 47s"`).
Instead a lone guest sees the ordinary empty-room notice **"Waiting for someone to join…"**, and the
60-second grace flow never runs — so the room is never ended with
`"The host has disconnected and the call has ended."` either. This violates PRD US-14 / FR-4.

### Root cause

The grace flow has a single trigger and a decoupled UI:

1. **Trigger is webhook-only.** `startGrace` is called *only* from the LiveKit `participant_left`
   webhook (`backend/src/webhooks.ts:32-35`), gated on
   `identity === room.hostIdentity && room.status === 'active'`. There is **no** `socket.on('disconnect')`
   handler in the backend, so a host tab-close (which drops the Socket.IO connection instantly) does
   not start grace. If the webhook is misconfigured/delayed, grace never fires.

2. **Frontend empty-state is decoupled from grace.** The "Waiting…" notice renders purely on
   `participants.length === 1` (`frontend/src/features/call/components/VideoGrid.tsx:81`,
   `ScreenShareView.tsx:40`), driven by the LiveKit client roster
   (`useParticipants.ts` → `RoomEvent.ParticipantDisconnected`), which updates **immediately** on
   tab close. The grace overlay renders independently on `graceSecondsLeft !== null`
   (`CallShell.tsx:117`), driven by the backend `grace_tick` socket event. The two are never
   mutually exclusive, so even after the backend fix the guest would see **both** the "Waiting…"
   text and the grace banner at once.

## Approach

**Treat a host Socket.IO disconnect as an unexpected connection drop** and drive grace from it as the
primary, reliable trigger — independent of the LiveKit webhook. Keep the webhook as a secondary
trigger (both start paths are idempotent). Fix the frontend so the empty-state and the grace overlay
are mutually exclusive.

Rejected alternative: fixing/relying on the LiveKit webhook alone — depends on LiveKit→backend
connectivity, carries detection lag, and does not satisfy "treat this as a connection drop."

## Design

Three coordinated changes.

### 1. Backend — start grace on host socket disconnect (`socket.ts`)

Register a `disconnect` listener in the connection wiring (`createSocketServer`, alongside
`join_chat` / `send_message` / `claim_share` / `release_share`). On disconnect:

- Read `socket.data.binding` (`{ identity, displayName, roomName }`). If absent (socket never
  completed `join_chat`), do nothing.
- Look up `room = registry.get(binding.roomName)`. If absent, do nothing.
- If `binding.identity === room.hostIdentity && room.status === 'active'`:
  - Clear any active screen share (mirror the webhook: `if (registry.clearShare(roomId)) onShareCleared(roomId)`).
  - Call `grace.startGrace(roomId)`.

Notes:
- The `status === 'active'` guard reuses the existing "intentional end" convention: `endCall` sets
  `status = 'ending'` first, so a deliberate "End call" never trips grace. Same gate as the webhook.
- `startGrace` is idempotent (`grace.ts:54` no-ops if a timer already exists), so the socket path and
  the webhook path can both fire for the same drop without duplicating the timer.
- The handler body must be wrapped so a throw cannot escape the listener
  (`logger.error({ err }, 'disconnect handler failed')`), per `.claude/rules/50-backend.md`.

### 2. Backend — cancel grace when the host returns over the socket (`handleJoinChat`)

After the socket is bound (`socket.data.binding` set, `socket.join(roomName)`), add:

- If `binding.identity === room.hostIdentity && room.status === 'grace'` → `grace.cancelGrace(roomId)`.

Rationale: connection-state-recovery is off, so a transient blip produces a **new** socket that
re-runs `join_chat` with the host's existing identity (still equal to `room.hostIdentity`, because no
REST re-join happened to rotate it). Without this, a blip would start grace and never cancel it (REST
`controller.ts:76` only cancels on a full re-join with `hostToken`), ending the room after 60s while
the host is still present. A full page reload continues to cancel via the existing REST path.

Wiring: expose `cancelGrace` to the socket gateway deps (today it receives `getGraceRemaining` but
not `cancelGrace`); add it in the composition root (`server.ts`) as
`cancelGrace: (roomId) => grace.cancelGrace(roomId)`.

### 3. Frontend — suppress "Waiting…" during grace (`VideoGrid.tsx`, `ScreenShareView.tsx`)

Gate the `t('waiting')` notice so it renders only when **not** in grace: show it when
`count === 1 && graceSecondsLeft === null`. Read `graceSecondsLeft` from `useConnectionStore`
(narrow selector). During grace the guest then sees only the grace overlay
(`"The host lost connection. Waiting for them to return..." / "Reconnecting... 47s"`), not the
misleading "Waiting for someone to join…".

The legitimate use of "Waiting…" (a guest is in, the host is present, waiting for other guests to
join) is unaffected because `graceSecondsLeft` is `null` in that case.

## Data flow (host tab-close)

```
Host closes tab
 ├─ LiveKit client (guest): RoomEvent.ParticipantDisconnected → roster → count===1 (immediate)
 │     but "Waiting…" suppressed because grace is about to be active
 ├─ Backend socket: 'disconnect' → binding.identity === hostIdentity && status==='active'
 │     → clearShare + grace.startGrace(roomId)
 │        → onTick → emitGraceTick(io, roomId, 60) → guest 'grace_tick' → GraceOverlay "Reconnecting... 60s"
 │        → per-second ticks …
 ├─ (secondary) LiveKit participant_left webhook → startGrace (idempotent no-op)
 │
 ├─ Host returns within 60s
 │    ├─ full reload: REST join w/ hostToken → controller cancels grace (existing)
 │    └─ socket reconnect: join_chat, identity===hostIdentity && status==='grace' → cancelGrace
 │         → emitGraceCancelled → guest 'grace_cancelled' → overlay clears
 └─ 60s elapse: grace endExpired → delete LiveKit room + markEnded + emitRoomEnded('grace_expired')
      → guest GraceExpiredScreen "The host has disconnected and the call has ended." + Back to home
```

## Testing

Server-authoritative logic (per `.claude/rules/60-testing.md`), co-located unit tests:

- `socket.ts` disconnect handler:
  - host socket (identity === hostIdentity, status 'active') disconnects → `startGrace` called; active share cleared.
  - guest socket disconnects → `startGrace` **not** called.
  - host socket disconnects while `status === 'ending'` (intentional End call) → `startGrace` **not** called.
  - socket with no `binding` disconnects → no-op, no throw.
- `handleJoinChat` cancel path:
  - host identity joins while `status === 'grace'` → `cancelGrace` called.
  - guest identity joins during grace → `cancelGrace` **not** called.
- Frontend: `VideoGrid` / `ScreenShareView` render "Waiting…" when `count===1 && grace===null`, and
  hide it when `graceSecondsLeft !== null`.

Manual smoke on the real `docker compose up --build` stack (green units are not "it works", per rules):
open host + guest, **close the host tab**, confirm the guest sees the grace overlay + countdown (not
"Waiting…"), then confirm both reconnect-within-60s (overlay clears) and 60s-elapsed (end screen).

## Out of scope

- LiveKit webhook configuration audit (kept as a secondary trigger; not required for the fix).
- A grace-start debounce for sub-second blips (explicitly declined — start immediately on disconnect).
- Server-authoritative roster (the brief flash window before `grace_tick` arrives is acceptable;
  gating "Waiting…" on grace covers the steady state).
