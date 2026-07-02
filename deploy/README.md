# Demo2 deploy (develop → staging.forasoft.com)

Deploys the app to the shared fora-soft demo server via GitLab CI (`deploy_develop` job, currently
`when: manual`). This is a **scaffold** — the items marked CONFIRM need DevOps sign-off before the
first deploy.

## Architecture

Three dockerized services (per fora-soft "all deps in docker"), each behind an nginx vhost on a
`*.staging.forasoft.com` subdomain (wildcard SSL is already on the server):

| Service  | Subdomain (dev env)                    | Container port | Notes                          |
|----------|----------------------------------------|----------------|--------------------------------|
| frontend | `dev-kmb.stg.forasoft.com`             | 80             | nginx-served SPA               |
| backend  | `dev-api-kmb.stg.forasoft.com`         | 3000           | REST + Socket.IO (WS)          |
| livekit  | `dev-livekit-kmb.stg.forasoft.com`     | 7880           | signaling (WSS)                |

Domain pattern: `*-kmb.stg.forasoft.com` (note: `stg`, and every host ends in `-kmb`).
Routing + TLS is done by **Traefik** (reverse proxy already on the server) via container labels — no
manual nginx vhosts and no nginx reload. So `deploy/nginx/*.conf` will be replaced by Traefik labels
on the services once the Traefik network / entrypoint / certresolver names are known.

LiveKit **media** (ICE) does not go through nginx: UDP range 50000–50100 and/or TCP 7881 + the shared
coturn TURN, advertising the server's public IP.

## Prerequisites (before flipping the deploy to automatic)

1. **GitLab → Settings → CI/CD → Variables** (scope: the `develop`/demo environment):
   - `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - `LIVEKIT_URL` = `wss://dev-livekit-kmb.stg.forasoft.com`
   - `CORS_ORIGIN` = `https://dev-kmb.stg.forasoft.com`
   - `VITE_API_BASE_URL` = `https://dev-api-kmb.stg.forasoft.com`
2. **Traefik labels** (replaces the nginx vhosts): once the Traefik network / entrypoint /
   certresolver names are known, add routing labels to the services in `docker-compose.develop.yml`.
3. **Still CONFIRM with DevOps**:
   - Traefik: docker network name, HTTPS entrypoint name, certresolver name.
   - LiveKit media: is a public UDP range open, or route media via coturn TURN?
     (coturn creds from the wiki: `forasoft` / `ajhfcjanfqccthdth`.) Wire the choice into `livekit.yaml`.

## Confirmed by DevOps

- Runner tag **`kmb-deploy`**, **docker executor** → CI `image:` works as-is.
- Domains: `*-kmb.stg.forasoft.com` (per-host TLS via Traefik + Let's Encrypt).
- Server public IP: **167.233.84.103** (used for `rtc.use_external_ip`).

## Files

- `../docker-compose.develop.yml` — standalone demo stack (livekit + backend + frontend).
- `livekit.yaml` — LiveKit prod config (mounted into the livekit container).
- `nginx/kmb-lashin.staging.conf` — the three vhosts for ops.

## First deploy

Push `develop`, then in the pipeline run the manual `deploy_develop` job. Once verified, change its
`when: manual` → `when: on_success` in `.gitlab-ci.yml`.
