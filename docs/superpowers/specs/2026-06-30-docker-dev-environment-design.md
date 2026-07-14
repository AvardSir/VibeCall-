# Docker Dev Environment — Design

**Date:** 2026-06-30
**Status:** Approved (pending spec review)
**Scope:** Run the whole stack (LiveKit SFU + backend + frontend) via a single `docker compose up`
for local development, with hot-reload. Native `npm run dev` scripts remain intact.

## Goal

`docker compose up` from the repo root brings up all three services with hot-reload, so a developer
needs only Docker installed (no local Node, no `livekit-server.exe`). Docker becomes the primary
local workflow; the existing root `concurrently` orchestrator and per-service `npm run dev` keep
working unchanged for those who prefer native.

Non-goals: production images, nginx static serving, TLS, multi-host/coturn networking. (A separate
prod spec can follow later.)

## Services

A single root `docker-compose.yml` defines three services on one user-defined bridge network
(`kmb-net`).

| Service | Image / build | Ports (host→container) | Hot-reload |
| --- | --- | --- | --- |
| `livekit` | `livekit/livekit-server:latest` | 7880, 7881, 7882/udp | n/a — official image, `--dev --bind 0.0.0.0` |
| `backend` | build `backend/Dockerfile.dev` (node:22) | 3000 | `tsx watch src/server.ts` over a source bind-mount |
| `frontend` | build `frontend/Dockerfile.dev` (node:22) | 5173 | `vite --host 0.0.0.0` over a source bind-mount |

Startup order: `backend` and `frontend` `depends_on: livekit`. (No healthcheck gating required for
dev; the app already tolerates LiveKit coming up moments later.)

## Networking model

Two distinct paths, and they must not be conflated:

- **Browser → service**: the browser runs on the host, so it reaches services via the *published
  host ports* — `http://localhost:3000` (REST/Socket.IO), `http://localhost:5173` (Vite),
  `ws://localhost:7880` (LiveKit media signaling). These match the existing env values, so they are
  **unchanged**.
- **Backend → LiveKit admin API**: this call originates *inside* the Docker network, so it uses the
  service name: `LIVEKIT_HOST=http://livekit:7880`. This is the only value that differs from native
  dev and is set in the compose `environment:` block (not by editing `backend/.env`).

Because of this split, `LIVEKIT_URL` (used by the browser) stays `ws://localhost:7880` while
`LIVEKIT_HOST` (used by the backend) becomes `http://livekit:7880`.

## Environment handling

Env overrides for the Docker context live directly in `docker-compose.yml` under each service's
`environment:` key — no new `.env.docker` file. Rationale: keeps native `npm run dev` (which reads
`backend/.env` / `frontend/.env`) working without contamination, and makes the Docker-specific
values self-documenting in one place.

- `backend` service env: `LIVEKIT_HOST=http://livekit:7880` (override). Everything else
  (`LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`, `LIVEKIT_URL=ws://localhost:7880`,
  `PORT=3000`, `FIXED_ROOM_NAME=main`, `CORS_ORIGIN=http://localhost:5173`) matches the committed
  `backend/.env.example` and is restated in compose for clarity.
- `frontend` service env: `VITE_API_BASE_URL=http://localhost:3000` (build/runtime via Vite).

The LiveKit `--dev` flag fixes the API key/secret to `devkey`/`secret`, which is exactly what the
backend expects — no key wiring needed.

## node_modules strategy

Bind-mount the source for hot-reload, but **do not** let the host's `node_modules` leak into the
container (the host is Windows; the container is Linux — native/platform-specific installs would
break). Pattern per service:

```yaml
volumes:
  - ./backend:/app           # source → hot-reload
  - /app/node_modules        # anonymous volume shields container's node_modules
```

Dependencies are installed during image build (`npm ci`), so the container always has a
Linux-correct `node_modules`.

## Persistence

Not needed yet. Room state is in-memory by design, and disk-backed attachments are **not yet
implemented** (no `attachments.ts`, no storage path in `config.ts`). When attachment storage lands,
add a named volume mounted at its configured path; until then, no volume is required and none is
created. (Noted here so the gap is explicit, not forgotten.)

## Vite host binding

Vite must listen on `0.0.0.0` inside the container or the published port is unreachable. Add
`server.host: true` (and keep `server.port: 5173`) to `frontend/vite.config.ts`, or pass
`--host 0.0.0.0` in the frontend dev command. Config change is preferred (greppable, also helps
native LAN testing).

## Files to add / change

```
docker-compose.yml            # NEW — 3 services, kmb-net network
backend/Dockerfile.dev        # NEW — node:22, WORKDIR /app, npm ci, CMD tsx watch
frontend/Dockerfile.dev       # NEW — node:22, WORKDIR /app, npm ci, CMD vite --host
backend/.dockerignore         # NEW — node_modules, dist, .env, *.log
frontend/.dockerignore        # NEW — node_modules, dist, .env, *.log
frontend/vite.config.ts       # EDIT — add server.host/port
README.md (root) or CLAUDE.md # EDIT — document `docker compose up` workflow
.gitignore                    # (verify) — no change expected
```

No application source code (backend `src/`, frontend `src/`) changes except the Vite config line.

## Verification

1. `docker compose up --build` → all three containers report healthy/running.
2. Browser at `http://localhost:5173` loads the app.
3. Host creates a room, a second browser tab/window joins as guest → both see/hear each other
   (LiveKit media flows over the published UDP port).
4. Text chat works between the two participants (exercises Socket.IO over the network).
5. Editing a `backend/src/*.ts` file restarts the backend (tsx watch); editing a
   `frontend/src/*.tsx` file hot-reloads the browser.
6. Native path unaffected: `npm run dev:app` (with native LiveKit) still works.

## Risks / notes

- **WebRTC UDP on Docker Desktop (Windows/WSL2):** publishing `7882/udp` is sufficient for
  `localhost` testing; LiveKit `--dev` advertises the node IP appropriately for loopback. If a
  second physical machine on the LAN must connect, that needs LiveKit `node_ip`/rtc config — out of
  scope for this dev setup.
- **First build is slow** (`npm ci` per image); subsequent builds use Docker layer cache keyed on
  `package*.json`.
