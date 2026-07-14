# Frontend Structure & Components

React 19 + TypeScript + Vite. **Feature-based** organization.

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

### React 19 conventions

- **`ref` is a normal prop — do NOT use `forwardRef`** (deprecated in React 19). A component that
  forwards a ref declares `ref?: Ref<HTMLElement>` in its props and passes it down.
- Annotate a component's return type with `import type { JSX } from 'react'` — there is no global
  `JSX` namespace under our React 19 / TS config.

### Reuse the shared UI primitives (don't re-roll)

- **Typography → `<Text>`** (`shared/ui/Text.tsx`): polymorphic (`tag` / `asChild`), `size` + `weight`.
  `Text` is typography-only — it does **not** own color; pass color via `className` at the call site.
- **Tooltips → `<Tooltip>`** (`shared/ui/Tooltip.tsx`): the design uses custom tooltips, so **never use
  the native `title` attribute** for tooltips. Wrap the trigger in `<Tooltip label=…>`.
- Prefer these (and `Button`, `Toggle`, `Slot`) over ad-hoc markup so styling/behavior stay consistent.

## Hooks

- File and symbol both `useThing`. One hook per file unless tightly related.
- Hooks encapsulate side effects (LiveKit subscriptions, socket events, permissions) so components
  stay declarative.

## Shared clients & data access (`shared/lib/`)

- **Realtime connection ownership.** A live Socket.IO connection is a *connection*, not UI state and
  not a chat concern. It lives in a **context provider** (`SocketProvider`) exposed via a
  `useSocket()` hook; feature hooks (`useChat`, …) *consume* `useSocket()` and only add their own
  listeners (`socket.off` the exact handlers on cleanup — never `removeAllListeners()`/`disconnect()`,
  which belong to the provider). Do not create a socket inside a feature hook.
- **Typed socket events.** Type the client as `Socket<ServerToClientEvents, ClientToServerEvents>`
  (`shared/lib/socketEvents.ts`) so `emit`/`on` are checked and payload casts disappear. These maps
  mirror the backend (`50-backend.md`); they are duplicated with a cross-ref comment until a shared
  contract module exists — keep both sides in sync.
- **`apiClient` pattern.** Build URLs in one place (`url-join`). Use a single generic
  `request<T>(url, init?)` wrapper; return the discriminated `ApiResponse<T, E>` envelope from
  `shared/types`. **Runtime-validate only security-critical payloads** (e.g. the join response that
  carries a LiveKit token — one `zod.safeParse`, fall back to `INTERNAL`); trivial/low-stakes
  responses are typed via the wrapper without a schema (schemas on *everything* are overhead).
