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

- Per-room channel keyed by room name. Event names are explicit and typed on both ends via
  `ServerToClientEvents` / `ClientToServerEvents` maps; construct `new Server<ClientToServerEvents,
  ServerToClientEvents, DefaultEventsMap, SocketData>(…)` so `emit`/`on` are checked. **Reality
  today:** the maps are **duplicated** on the frontend (`shared/lib/socketEvents.ts`) with a cross-ref
  comment — this repo is not an npm workspace. A shared contract module is a planned follow-up; until
  then keep both copies in sync.
- **Use Socket.IO's own generic `Socket`/`Server` types** in handlers (alias them, e.g. `ChatSocket`
  / `ChatServer`, with `SocketData` carrying the binding). Do **not** hand-roll structural subtypes
  of the socket/server API.
- **Compose Socket.IO onto the Express app correctly — Express is the base HTTP handler, Socket.IO
  *wraps* it.** Build the Express `app` first, then `const httpServer = createServer(app); io.attach(httpServer);`.
  Construct the `Server` **detached** (`new Server({ cors })`, no http server) so it can be created
  before the app and attached afterward. **Never** create a bare `createServer()`, attach Socket.IO to
  it, then add Express with `httpServer.on('request', app)`: Socket.IO *snapshots* the server's
  `request` listeners at attach time, so an Express handler added afterward becomes a **second,
  independent** `request` listener. Both then fire on every request; on a `/socket.io/…` handshake
  engine.io responds and Express then calls `setHeader` on the already-sent response →
  `ERR_HTTP_HEADERS_SENT`, an **uncaught exception that crashes the process on the first socket
  connection**. This shipped once (2026-07-01) despite green unit gates, because the crash lives in
  `server.ts` composition, not in `createApp`. After `io.attach`, the wired `httpServer` must have
  **exactly one** `request` listener (Socket.IO's delegate, which forwards non-socket requests to Express).
- **Guard every listener.** Wrap each `socket.on(event, …)` body so a throw can't escape into the
  runtime — `logger.error({ err }, '<event> handler failed')` (mirror this across all events, sync or
  async). An uncaught throw in a listener can crash the process.
- **Dependency injection is the house style** — pass a small deps object (mirrors `createApp`'s
  `AppDeps`); don't switch one module to direct singleton imports and leave the rest on DI.
- The backend owns chat fully (relay + history + unread); clients send intents, server decides.
