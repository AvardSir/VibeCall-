# Subtask 4 — Configure CI and Deploy App

- **Version:** 1.0
- **Date:** 2026-06-29
- **Status:** Approved for planning
- **Parent:** `docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md` (master spec)
- **Decomposition:** `docs/superpowers/specs/subtasks/00-overview.md`
- **Depends on:** Subtasks 1–3 — there must be a buildable `backend/` (REST + Socket.IO) and
  `frontend/` (Vite app). This subtask packages and ships whatever they produce; it adds **no
  product behavior**.

---

## 1. Goal

- A `docker-compose.yml` that runs the whole system (frontend, backend, **self-hosted LiveKit
  SFU**, TLS edge).
- A **GitLab CI** pipeline that lints/tests, builds images, pushes them to **GHCR**, and deploys on
  the demo server itself (the runner is co-located on that server — no SSH hop).
- The project is **deployed and reachable on a demo Linux VPS** over HTTPS.

## 2. Decisions (confirmed)

| Concern | Choice |
| --- | --- |
| CI provider | **GitLab CI** (`.gitlab-ci.yml`) |
| Deploy target | **Single Linux VPS — the GitLab runner runs *on that VPS*.** Deploy is a **local `docker compose`** step in the runner's workspace; **no SSH**. |
| Image registry | **GHCR** (`ghcr.io`) — CI builds & pushes, the server (same host as the runner) pulls |
| TLS / edge | **nginx** reverse proxy + an **ACME companion** (certbot / acme.sh) for Let's Encrypt issuance & renewal |

> WebRTC / `getUserMedia` require a **secure context (HTTPS)** and LiveKit signaling needs **WSS** —
> hence the TLS edge is mandatory, not optional, even for a demo.

## 3. Scope boundary

### In scope

- Production/demo `docker-compose.yml` with all services + an `nginx.conf` (+ the ACME companion) +
  `livekit.yaml`.
- Multi-stage `Dockerfile`s for `backend/` and `frontend/`.
- `.gitlab-ci.yml`: stages **test → build → push (GHCR) → deploy (local `docker compose` on the
  runner's host)**.
- Server-side `.env.example` and the GitLab **CI/CD variables** list (secrets — never in the repo).
- A backend **health endpoint** (`GET /healthz`) for container healthchecks + a deploy smoke check.

### Deferred / out of scope (matches master §8 "single process, no horizontal scaling")

- Multi-node LiveKit, Redis, HA, autoscaling, blue-green/canary.
- External secrets manager (secrets live in GitLab CI/CD variables + a server `.env`).
- Monitoring/alerting/log aggregation beyond container healthchecks + restart policy.
- Staging environments (one **demo** environment only).

## 4. Runtime topology (compose services)

```
                         Internet (443/tcp, 80/tcp)
                                  │
                          ┌───────▼────────┐   TLS via nginx; certs from the
                          │     nginx      │   ACME companion (Let's Encrypt)
                          └──┬─────┬─────┬─┘          ▲ shared cert volume
            app.<domain> /   │     │     │   livekit.<domain> (wss signaling)
        ┌─────────────────┐  │     │     │  ┌────────────────────────────┐   ┌──────────────┐
        │  web (frontend) │◀─┘     │     └─▶│  livekit (SFU)             │   │ acme companion│
        │  static assets  │        │        │  + UDP media ports (host)  │   │ (certbot/acme)│
        └─────────────────┘        ▼        └────────────────────────────┘   └──────────────┘
                          ┌─────────────────┐            ▲ server API (internal)
                          │  backend        │────────────┘  RoomServiceClient
                          │  REST + Socket  │  + token minting (shared key/secret)
                          └─────────────────┘
```

| Service | Image | Role | Ports / notes |
| --- | --- | --- | --- |
| `nginx` | official `nginx` | TLS termination + reverse proxy; routes `app.<domain>` → web, `/api` + Socket.IO → backend (with WebSocket `Upgrade` headers), `livekit.<domain>` → LiveKit WSS. | Publishes **80/tcp**, **443/tcp**. Mounts `nginx.conf` + the shared cert volume (read-only). |
| `acme` | `certbot/certbot` (or an acme.sh image) | Issues & **renews** Let's Encrypt certs into the shared cert volume; HTTP-01 challenge served via nginx on `:80`. nginx reloads on renewal. | No published ports of its own; writes to the cert volume nginx reads. |
| `web` | built from `frontend/Dockerfile` (GHCR) | Serves the built Vite static bundle (static file server). | Internal only; behind nginx. |
| `backend` | built from `backend/Dockerfile` (GHCR) | Control plane: REST + Socket.IO; mints LiveKit tokens; calls LiveKit server API. | Internal only; behind nginx. Volume for attachments (later subtasks). Healthcheck → `GET /healthz`. |
| `livekit` | official `livekit/livekit-server` | SFU media. | **WSS signaling** via nginx; **UDP media port range** published directly on the host (nginx does not proxy UDP); `rtc.use_external_ip: true`. Config from `livekit.yaml`. |

**LiveKit URL split (important for config):**
- Clients get the **public** `LIVEKIT_URL = wss://livekit.<domain>` (returned by `/join`, per
  `01-join-room.md` §4.2).
- The backend's `RoomServiceClient` (capacity `listParticipants`, `ensureRoom`) talks to LiveKit on
  the **internal** address `http://livekit:7880` with the shared API key/secret.

## 5. Configuration & secrets

- **No secrets in the repo** (`.claude/rules/50-backend.md`). Provided two ways:
  - **GitLab CI/CD variables** (masked/protected): `GHCR_USER`, `GHCR_TOKEN` (a GitHub PAT with
    `write:packages` — GitLab CI authenticates to `ghcr.io`), plus the deploy-time app secrets
    below. **No SSH credentials** — the runner is on the deploy host, so the `deploy` job runs
    `docker compose` locally (the runner's service account needs Docker access on that host).
  - **Server `.env`** (consumed by `docker-compose.yml`, gitignored; an `.env.example` is committed):
    `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (shared by `backend` and `livekit`), `LIVEKIT_URL`
    (public wss), `FIXED_ROOM_NAME`, `PUBLIC_BASE_URL` / `CORS_ORIGIN` (= `https://app.<domain>`),
    `APP_DOMAIN`, `LIVEKIT_DOMAIN`, `LETSENCRYPT_EMAIL`.
- The LiveKit API key/secret are the **same** values handed to the SFU (`livekit.yaml`) and the
  backend (token minting + admin) — they must match.

## 6. GitLab CI pipeline (`.gitlab-ci.yml`)

Stages run on push; **deploy** is gated to the default branch (or a tag) and bound to a GitLab
`environment: demo`.

| Stage | Does | Gate |
| --- | --- | --- |
| `test` | In `backend/` and `frontend/`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`. | Must pass (`.claude/rules/60-testing.md` — clean build is part of "done"). |
| `build` | `docker build` backend + frontend images, tagged with the commit SHA **and** a moving `:demo` tag. | After `test`. |
| `push` | `docker login ghcr.io` (GHCR_USER/GHCR_TOKEN) → push both images. | After `build`. |
| `deploy` | **Runs on the VPS itself** (a runner tagged for the demo host): in the job's checkout, `docker compose pull && docker compose up -d --remove-orphans`, then a **smoke check** (`curl -fsS https://app.<domain>` + backend `/healthz`). | Default branch / tag only; `environment: demo`. |

- The `deploy` job runs **on the demo host** via a GitLab runner installed there (selected with a
  runner **tag**, e.g. `tags: [demo]`). It uses the repo's own checkout for `docker-compose.yml` (+
  `nginx.conf`, `livekit.yaml`) — **no `scp`/`rsync`/SSH**. Images come from GHCR by tag; the
  deploy `docker login ghcr.io` so the host can pull private images.
- Deploy is **recreate** (`up -d`); brief downtime is acceptable for a demo (no blue-green).

## 7. Files produced

- `docker-compose.yml` — the services above (nginx, acme, web, backend, livekit) (+ a `docker-compose.override.yml` for local dev if useful).
- `backend/Dockerfile`, `frontend/Dockerfile` — multi-stage (build → slim runtime).
- `nginx.conf` — domains, reverse-proxy routes (incl. WebSocket `Upgrade` for `/api`+Socket.IO and `livekit.<domain>`), `ssl_certificate` paths on the shared cert volume, HTTP-01 challenge location, HTTP→HTTPS redirect.
- ACME companion wiring — the `acme` service + its renewal hook that reloads nginx (e.g. a deploy-hook or `nginx -s reload`).
- `livekit.yaml` — keys, `rtc` UDP port range + `use_external_ip`, WSS via the edge.
- `.gitlab-ci.yml` — the pipeline.
- `.env.example` — the server env contract (no real secrets).
- Backend: add `GET /healthz` (returns `200`), used by the container healthcheck and the deploy smoke check.

## 8. Operational notes

- **Volumes:** the **shared Let's Encrypt cert volume** (written by `acme`, read by `nginx`); LiveKit
  data; backend attachments (used by a later subtask). All on named volumes so a `compose up`
  redeploy preserves them — in particular, certs survive redeploys so issuance isn't repeated.
- **Restart policy:** `restart: unless-stopped` on long-running services; container `healthcheck`
  on `backend`.
- **Firewall:** open **443/tcp**, **80/tcp** (nginx — `:80` is also required for the ACME HTTP-01
  challenge) and the **LiveKit UDP media port range** (+ the TCP fallback). Media UDP bypasses nginx
  and hits the host directly.
- **Ephemerality (master §8):** backend state is in-memory; a redeploy/restart ends active calls and
  clears chat/attachments — acceptable for the demo.
- **Idle-room reaper / rate-limit** (master §8) run inside the backend; nothing infra-specific here.

## 9. Verification

- CI `test` stage is the correctness gate (lint + typecheck + unit tests from subtasks 1–3).
- `deploy` smoke check: HTTPS reachable + backend `/healthz` `200`.
- Manual demo acceptance: open `https://app.<domain>` in two browsers → both join the single room →
  see/hear each other (subtask 3) and exchange chat (subtask 2); a 5th tab gets "This call is full."
  (subtask 1).

## 10. Open notes & known limitations

- **Cross-provider auth.** GitLab CI pushes to **GHCR**, so it logs in to `ghcr.io` with a GitHub
  PAT stored as a GitLab CI/CD variable (GitLab's own registry is not used).
- **Runner-on-host deploy.** The `deploy` job has no SSH; it relies on a GitLab runner installed on
  the demo VPS with Docker access. Trade-off: simpler (no key management) but the host and the
  runner share a trust boundary, and the demo host must always have a healthy registered runner —
  if that runner is down, deploys can't run. Acceptable for a single demo box.
- **TLS via companion.** Unlike Caddy's built-in ACME, nginx needs the `acme` companion to issue and
  renew certs and an `nginx -s reload` on renewal. First boot must complete the HTTP-01 challenge on
  `:80` before HTTPS is available — order nginx/acme startup so the challenge can be served.
- **Single node.** No Redis / multi-node LiveKit (master §8 declares single-process, no horizontal
  scaling). HA, autoscaling, and staging are out of scope.
- **Secrets** live in GitLab CI/CD variables + a server `.env`, not a managed vault — adequate for a
  demo; tighten for production.
- **UDP reachability** is the most common WebRTC deploy pitfall: the LiveKit UDP range must be open
  end-to-end and `use_external_ip` set, or media fails while signaling succeeds.

## 11. Forward-compatibility mapping

| This subtask | Scales to (later, out of current scope) |
| --- | --- |
| Single-node compose | LiveKit + Redis multi-node, load-balanced backend (master §8 notes this is out of scope) |
| One `demo` environment, recreate deploy | staging + prod environments, zero-downtime rollout |
| Secrets in CI variables / server `.env` | external secrets manager |
| Healthcheck + smoke check | full monitoring / log aggregation / alerting |
