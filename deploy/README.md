# Demo2 deploy (develop → staging.forasoft.com)

Deploys the app to the shared fora-soft demo server via GitLab CI (`deploy_develop` job, currently
`when: manual`). This is a **scaffold** — the items marked CONFIRM need DevOps sign-off before the
first deploy.

## Architecture

Three dockerized services (per fora-soft "all deps in docker"), each behind an nginx vhost on a
`*.staging.forasoft.com` subdomain (wildcard SSL is already on the server):

| Service  | Subdomain                                     | Host port | Notes                          |
|----------|-----------------------------------------------|-----------|--------------------------------|
| frontend | `dev-kmb-lashin.staging.forasoft.com`         | 8080      | nginx-served SPA               |
| backend  | `dev-kmb-lashin-api.staging.forasoft.com`     | 3010      | REST + Socket.IO (WSS upgrade) |
| livekit  | `dev-kmb-lashin-livekit.staging.forasoft.com` | 7880      | signaling via nginx WSS        |

LiveKit **media** (ICE) does not go through nginx: UDP range 50000–50100 and/or TCP 7881 + the shared
coturn TURN, advertising the server's public IP.

## Prerequisites (before flipping the deploy to automatic)

1. **GitLab → Settings → CI/CD → Variables** (scope: the `develop`/demo environment):
   - `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - `LIVEKIT_URL` = `wss://dev-kmb-lashin-livekit.staging.forasoft.com`
   - `CORS_ORIGIN` = `https://dev-kmb-lashin.staging.forasoft.com`
   - `VITE_API_BASE_URL` = `https://dev-kmb-lashin-api.staging.forasoft.com`
2. **nginx vhosts**: give `nginx/kmb-lashin.staging.conf` to an ops maintainer (Leonid / Denis /
   Andrey) to install in `/etc/nginx/conf.d/` and reload. Confirm the exact wildcard-SSL include.
3. **CONFIRM with DevOps**:
   - LiveKit media: is UDP 50000–50100 open, or should we go TCP + coturn TURN only?
     (coturn creds from the wiki: `forasoft` / `ajhfcjanfqccthdth`.) Wire the choice into `livekit.yaml`.
   - Public IP for `rtc.use_external_ip`.
   - Host ports 8080 / 3010 / 7880 — likely fine on a dedicated box, but confirm the actual
     public URLs/domains (a dedicated server may not use `*.staging.forasoft.com`).

## Runner

DevOps assigned the runner tag **`kmb-deploy`** (this project's own runner — per the wiki, a
dedicated server gets a `PROJECT_NAME-deploy` runner). All CI jobs are tagged with it. This assumes
a **docker executor** (so `image:` works for the validation jobs); if it's a **shell executor**, the
validation jobs must run Node on the host instead of via `image: node:22-alpine`. CONFIRM the
executor type with DevOps.

## Files

- `../docker-compose.develop.yml` — standalone demo stack (livekit + backend + frontend).
- `livekit.yaml` — LiveKit prod config (mounted into the livekit container).
- `nginx/kmb-lashin.staging.conf` — the three vhosts for ops.

## First deploy

Push `develop`, then in the pipeline run the manual `deploy_develop` job. Once verified, change its
`when: manual` → `when: on_success` in `.gitlab-ci.yml`.
