# Backend Conventions

Single Node + TypeScript control-plane service in `backend/`. Media never passes through it.

## Module structure

Organize `src/` by responsibility (one folder/module each):

```
backend/src/
  tokens/         # LiveKit AccessToken generation
  rooms/          # in-memory room registry: lifecycle, participants, capacity, host identity
  hostActions/    # removeGuest, endCall via LiveKit RoomServiceClient
  grace/          # host-reconnect 60s countdown (webhooks + timers)
  chat/           # Socket.IO relay, in-memory history, unread tracking
  attachments/    # upload validation, local-disk storage, download serving, cleanup
  webhooks/       # LiveKit webhook receiver
  lib/            # shared helpers, logger, env config
  server.ts       # composition root: wires modules, starts HTTP + Socket.IO
```

A module exposes a small typed API; keep types in the module (`rooms/types.ts`) unless shared.

## Conventions

- **Logger, not `console.log`** for application output. One configured logger in `lib/`.
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
