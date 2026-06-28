# Backend Conventions

Single Node + TypeScript control-plane service in `backend/`. Media never passes through it.

## Module structure

This is a small control-plane service, so `src/` uses **flat modules — one file per
responsibility** (not a folder per module). Keep each file focused and its API small:

```
backend/src/
  config.ts        # env loading + validation (fail fast on missing vars)
  logger.ts        # the single application logger (no raw console.log anywhere else)
  validation.ts    # name validation (length, allowed chars)
  rooms.ts         # in-memory room registry: lifecycle, participants, capacity, host identity,
                   #   screen-share arbitration, member tokens; owns RoomState/Participant/ChatMessage types
  livekitTokens.ts # LiveKit AccessToken generation
  livekitAdmin.ts  # host actions (remove participant, delete room) via RoomServiceClient
  attachments.ts   # upload validation, local-disk storage, download serving, cleanup
  chat.ts          # chat message build/validation + in-memory history
  socket.ts        # Socket.IO wiring: chat relay + screen-share arbitration + broadcast helpers
  grace.ts         # host-reconnect 60s countdown controller (injectable timers)
  webhooks.ts      # LiveKit webhook dispatcher
  server.ts        # composition root: wires modules, starts HTTP + Socket.IO
```

A module exposes a small typed API and owns its types (cross-cutting types live with their
primary owner, e.g. `rooms.ts`). Promote a responsibility to its own folder with a local
`types.ts` only once it grows enough to need multiple internal files — don't pre-split.

## Conventions

- **Logger, not `console.log`** for application output. One configured logger module
  (`logger.ts`) is the only place allowed to touch `console`; everything else logs through it.
- **Config from environment only** (`backend/.env`, gitignored) — LiveKit API key/secret/URL and
  any ports/paths. Never hardcode secrets. Validate required env vars at startup, fail fast.
- **Tokens** via the LiveKit server SDK `AccessToken` helper — no hand-rolled JWT.
- **Authority is server-side.** Re-validate every host action against the recorded host identity;
  never trust a client-supplied role. (Behavioral detail is in the spec.)
- **Errors:** throw/return typed errors with a stable `code`; map them to HTTP status + a client
  error code at the edge. Don't leak internal messages.
- Async/await throughout; no floating promises (handle or `void` deliberately).
- Validate inbound REST/socket payloads at the boundary before acting on them.

## Socket.IO

- Per-room channel keyed by room name. Event names are explicit and typed on both ends
  (define a shared event-payload type module).
- The backend owns chat fully (relay + history + unread); clients send intents, server decides.
