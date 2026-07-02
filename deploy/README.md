# Demo2 deploy (develop → *.stg.forasoft.com)

Deploys the app to the fora-soft demo server via GitLab CI (`deploy_develop` job, currently
`when: manual`). Two DevOps answers are still pending (below); the rest is wired up.

## Architecture

Three dockerized services (per fora-soft "all deps in docker"), routed by **Traefik** (external
docker network `traefik`, entrypoint `http`, TLS terminated upstream) via container labels — no nginx
vhosts. The `kmb-deploy` runner deploys onto the host docker, so the containers live on the server and
Traefik reaches them over the `traefik` network. Frontend/backend are not published to host ports.

| Service  | Host (dev env)                     | Container port | Routed by |
|----------|------------------------------------|----------------|-----------|
| frontend | `dev-kmb.stg.forasoft.com`         | 80             | Traefik   |
| backend  | `dev-api-kmb.stg.forasoft.com`     | 3000           | Traefik (WS ok) |
| livekit  | `dev-livekit-kmb.stg.forasoft.com` | 7880           | Traefik (signaling) |

LiveKit **media** (WebRTC ICE) bypasses Traefik: published host ports — TCP 7881 + UDP 50000–50100 —
with `rtc.use_external_ip` advertising the server IP. If that UDP range is not open, drop it and route
media via the shared coturn TURN (creds in the wiki: `forasoft` / `ajhfcjanfqccthdth`) in `livekit.yaml`.

## Confirmed by DevOps

- Runner **`kmb-deploy`**, **docker executor**, deploys onto the **host docker** (containers persist,
  Traefik-visible).
- Traefik: network **`traefik`**, entrypoint **`http`**, **no certresolver** (TLS upstream of Traefik).
- **Public scheme: HTTPS** (TLS terminated upstream) → secure context OK for camera/mic/screen-share;
  variables use `https` / `wss`.
- Domains `*-kmb.stg.forasoft.com` — `dev-kmb` / `dev-api-kmb` / `dev-livekit-kmb` already resolve.
- Server public IP **167.233.84.103** (LiveKit `rtc.use_external_ip`).

## Still pending (1 answer)

- **LiveKit media:** is UDP 50000–50100 open, or should we drop it and use coturn TURN? Adjust the
  `livekit` ports in `docker-compose.develop.yml` + `livekit.yaml` accordingly.

## Your action — GitLab → Settings → CI/CD → Variables (scope: develop)

- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `LIVEKIT_URL` = `wss://dev-livekit-kmb.stg.forasoft.com`
- `CORS_ORIGIN` = `https://dev-kmb.stg.forasoft.com`
- `VITE_API_BASE_URL` = `https://dev-api-kmb.stg.forasoft.com`

## Files

- `../docker-compose.develop.yml` — standalone demo stack (livekit + backend + frontend) with Traefik labels.
- `livekit.yaml` — LiveKit prod config (mounted into the livekit container).

## First deploy

Push `develop`, then run the manual `deploy_develop` job in the pipeline. Once verified, change its
`when: manual` → `when: on_success` in `.gitlab-ci.yml`.
