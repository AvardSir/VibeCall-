# TypeScript Conventions

Applies to both `frontend/` and `backend/`.

## Types & interfaces

- **`PascalCase`, no `I`-prefix:** `RoomState`, `ChatMessage`, `Participant` — never `IRoom`.
- Prefer **`type`** for unions, primitives, and object shapes; use **`interface`** only when you
  need declaration merging or `extends` chains. Be consistent within a file.
- Model finite sets as **string-literal unions**, not `enum`:
  `type ParticipantRole = 'host' | 'guest'`.
- Co-locate a type with its owner. Cross-cutting/shared types go in `shared/types/` (frontend) or
  a `types.ts` in the relevant backend module.
- Derive, don't duplicate: `Pick`, `Omit`, `ReturnType`, `Parameters` over re-declaring shapes.

## Strictness

- **Never use `any`.** Use `unknown` + a type guard, a generic, or a precise type.
- No inline `// eslint-disable` and no `// @ts-ignore` / `@ts-expect-error` without a one-line
  justifying comment.
- `tsconfig` runs in `strict` mode; keep `tsc --noEmit` clean.
- Functions that cross a module/API boundary get **explicit return types**. Internal helpers may
  rely on inference.

## Values & imports

- **Variables/functions** `camelCase`; **constants** `UPPER_SNAKE_CASE`; **components** `PascalCase`.
- Use `import type { … }` for type-only imports.
- No default exports except where a tool requires it (e.g. Vite config, a route module) — prefer
  named exports so symbols are greppable and rename-safe.
