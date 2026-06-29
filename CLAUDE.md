# kmb-video-chat

No-sign-up group video calling web app. Up to **4 participants** per room. One **host** creates
a room and owns it; **guests** join via a shared participant link. Desktop only (≥1024px).

## Language

All documentation, comments, and code artifacts MUST be in **English**. User-facing UI strings
are localized **EN (default) / RU** via react-i18next.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite, LiveKit Components React SDK, Tailwind CSS, react-i18next (Node.js 22)
- **Backend**: Node + TypeScript control-plane service, Socket.IO 4 for chat/presence (Node.js 22)
- **Media**: Self-hosted **local LiveKit** server (SFU) — carries all camera/mic/screen-share media
- **Tokens**: LiveKit server SDK `AccessToken` helper (no hand-rolled JWT)
- **Storage**: Attachments on local disk, room-scoped folders (no database; room state in-memory)

## Project Structure

```
backend/
  src/                Node + TS control plane (rooms, tokens, chat, attachments, webhooks)
frontend/             React + Vite app (16 screens, video grid, chat, overlays)  [to be created]
docs/
  superpowers/specs/  Technical design spec (source of truth)
  superpowers/plans/  Implementation plans
KMB_VideoChat_Wireframes_with_Overview (1) (1).html   Wireframe inventory (16 screens)
CONTEXT.md            Running project context
```

## Commands

```bash
# LiveKit (local SFU) — run separately, backend needs its API key/secret/URL
livekit-server --dev

# Per-service (inside backend/ or frontend/)
npm run dev           # Development (watch mode)
npm run build         # Production build
npm run lint          # ESLint
npm run lint:fix      # ESLint autofix
npm run typecheck     # TypeScript check (tsc --noEmit)
```

> Concrete scripts are not all defined yet — fill them in as the implementation phase begins.

## Architecture

### REST + control plane
```
Frontend → Backend (rooms, tokens, host actions: remove/end) → LiveKit Server API
```

### Real-time flow
```
Frontend ↔ Socket.IO ↔ Backend (chat relay, history, presence, 60s host-grace timer)
Frontend ↔ WebRTC media ↔ LiveKit (SFU)   ·   LiveKit webhooks → Backend
```

Media never passes through the backend. The backend is the authority for room lifecycle,
host/guest roles, the host-reconnect grace timer, chat, and attachments.

## Source of Truth (read these first)

- `prd-kmb-video-chat.md` (v2.0) — product requirements (user stories, FRs, validation, exact UI strings). **Binding** for product behavior.
- `KMB_VideoChat_Wireframes_with_Overview.html` — 16 screens (Host H1–H6, Guest G1–G6, System S1–S4) with elements, states, and verbatim UI strings.
- `docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md` — technical design derived from the PRD/wireframes (architecture, REST + Socket.IO interfaces, data models, screen map, flows, validation).
- `docs/superpowers/specs/subtasks/` — per-subtask specs (forward-compatible subsets of the technical design).
- `docs/superpowers/plans/` — implementation plans. `CONTEXT.md` — running context.

> The PRD (`prd-kmb-video-chat.md` v2.0) is now in the repo and is **binding** for product behavior.
> Where the technical design had diverged from it (name uniqueness, host-token placement, camera-off
> tile), the PRD wins — the specs have been reconciled to the PRD.

## Rules (auto-loaded)

Detailed rules live in `.claude/rules/` — loaded automatically. Read the relevant file before
working in its area:

| File | Covers |
| --- | --- |
| `00-project-base.md` | Stack, core principles, naming, layout — the base the rest derive from |
| `10-typescript.md` | Type/interface naming (PascalCase, no `I`), strictness, imports |
| `20-frontend-structure.md` | Feature-based folders, component & hook conventions |
| `30-state-store.md` | Zustand: one store per domain, actions-in-store, selector subscriptions |
| `40-styling-and-i18n.md` | Tailwind theming (`dark:`), react-i18next, no hardcoded strings |
| `50-backend.md` | Node/TS module split, logger, env config, errors, Socket.IO |
| `60-testing.md` | Co-located tests, what to test, deterministic mocks |

> These rules cover **how we write code**. Product/domain rules (screens, limits, verbatim UI
> strings, roles, screen-share behavior) live in the spec at `docs/superpowers/specs/`.

## Critical Rules (summary — see `.claude/rules/` for detail)

### NEVER
- Start implementation while at the spec stage — wait for an explicit user request
- Use `any`, inline `// eslint-disable`, `// @ts-ignore`, or `console.log`
- Hardcode secrets / API keys — read them from env (`backend/.env`)
- Hardcode user-facing strings in components — everything goes through i18n
- Trust the client for authority — re-validate state/role server-side
- Add abstractions "for later" — keep it straightforward, match the requirements

### ALWAYS
- `PascalCase` types/interfaces with no `I`-prefix; string-literal unions over `enum`
- Feature-based frontend layout; logic in hooks/stores, components stay presentational
- One Zustand store per domain; actions live in the store; subscribe to narrow slices
- Theme via Tailwind `dark:` variants (Dark default); UI text via react-i18next (EN/RU)
- Keep `tsc --noEmit` and ESLint clean; co-locate tests (`*.test.ts` next to source)
