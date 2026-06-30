# Project Base

The foundation of the codebase. The other rule files (`10-…`, `20-…`, …) elaborate on the
conventions introduced here. Read this first.

> **Scope of these rules:** *how we write code* (engineering conventions), not *what we build*.
> Product/domain rules (screens, limits, verbatim UI strings, roles, screen-share behavior) live
> in the technical spec at `docs/superpowers/specs/` — not here.

## Stack

| Area | Choice |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite |
| Media | LiveKit Components React SDK + local LiveKit server (SFU) |
| Styling | Tailwind CSS (`dark:` variants for theming) |
| i18n | react-i18next (EN default / RU) |
| State | **Zustand** (one store per domain) |
| Backend | Node + TypeScript, Socket.IO 4 |
| Runtime | Node.js 22 |

## Core principles

- **Straightforward over clever.** Match the requirements; do not over-engineer or add
  abstractions "for later."
- **One source of truth per concern.** Server is authoritative for room/role state; the store is
  authoritative for client UI state; translation resources are authoritative for user text.
- **Strict typing.** No `any`. The build must pass `tsc --noEmit` and ESLint with zero warnings.
- **Co-located, small modules.** Keep related code together (see `20-frontend-structure.md`).
- **No hardcoded user-facing strings** — everything goes through i18n (`40-styling-and-i18n.md`).

## Naming (quick reference — details in `10-typescript.md`)

- **Types / interfaces / components:** `PascalCase`, no `I`-prefix (`RoomState`, `ChatMessage`).
- **Variables / functions:** `camelCase`. **Constants:** `UPPER_SNAKE_CASE`.
- **React components:** `PascalCase.tsx`. **Hooks:** `useThing.ts`. **Stores:** `useThingStore.ts`.
- **Other files:** `kebab-case.ts`.

## Project layout

```
backend/
  src/                Node + TS control plane (see 50-backend.md for module split)
frontend/             React + Vite app (feature-based — see 20-frontend-structure.md)
docs/superpowers/     Specs (product source of truth) and plans
```

> These engineering defaults (Zustand, feature-based layout, PascalCase no-prefix) are starting
> points generated from this base — adjust them here and the rest of the rules should follow.
