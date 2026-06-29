# Frontend Structure & Components

React 18 + TypeScript + Vite. **Feature-based** organization.

## Folder layout

```
frontend/src/
  features/
    prejoin/        # pre-join screen: preview, device toggles, name
    call/           # in-call grid, controls, screen share
    chat/           # chat panel, message list, attachments
    room-states/    # left / removed / ended / full / not-found / unsupported screens
  shared/
    ui/             # presentational, reusable components (Button, Toggle, Modal)
    hooks/          # cross-feature hooks
    lib/            # api client, socket client, livekit helpers, utils
    types/          # cross-cutting types
    i18n/           # i18next config + EN/RU resources
  stores/           # Zustand stores (see 30-state-store.md)
  App.tsx
  main.tsx
```

Each feature folder owns its `components/`, `hooks/`, and local `types.ts`. A feature may import
from `shared/` but **not** from another feature's internals — share via `shared/`.

## Enforcing boundaries (lint)

This lightweight, feature-based layering is the chosen architecture — **Feature-Sliced Design (FSD)
and its `steiger` linter are intentionally not used** (overkill for an app this size; see
`00-project-base.md` "straightforward over clever"). The boundaries above are enforced as part of
`npm run lint` via **`eslint-plugin-boundaries`** (no separate architecture tool). Element types and
allowed imports:

- `app` (`App.tsx`, `main.tsx`) → may import `features`, `shared`, `stores`.
- `feature` (`features/*`) → may import `shared` and `stores`; **may not** import another feature,
  nor reach into a feature's internals (import only its public entry, e.g. `features/chat`).
- `shared` (`shared/*`) → may import only `shared`.
- `stores` (`stores/*`) → may import `shared` (UI state only; no feature imports).

Lighter fallback if the plugin is unwanted: `no-restricted-imports` patterns banning
`features/*/**` cross-imports. Keep these rules in the frontend ESLint flat config.

## Components

- One component per file; file name matches the component (`VideoTile.tsx` → `VideoTile`).
- **Function components + hooks only.** No class components.
- Props type named `<Component>Props`, declared in the same file.
- Keep components presentational where possible; push logic into hooks (`useX`) and stores.
- No data fetching or socket calls inside JSX — do it in hooks/effects or store actions.
- Subscribe to the **narrowest** store slice a component needs (avoid whole-store subscriptions).

## Hooks

- File and symbol both `useThing`. One hook per file unless tightly related.
- Hooks encapsulate side effects (LiveKit subscriptions, socket events, permissions) so components
  stay declarative.
