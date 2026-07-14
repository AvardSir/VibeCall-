# Subtask 1 — User Can Join Room — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one fixed 4-seat room: a user opens the app, sees a pre-join screen with their own mirrored camera preview and a validated name field, and either enters the call with their **own** media or hits the "This call is full." screen when the room already holds 4 people.

**Architecture:** A Node + TypeScript control-plane (Express) mints LiveKit guest tokens and gates capacity by reading the live participant count from LiveKit (`listParticipants`), backstopped by the room's hard `maxParticipants: 4`. A React + Vite frontend handles device permissions and the pre-join preview itself via `getUserMedia`, then connects through the LiveKit Components React SDK (`<LiveKitRoom>`), rendering only the local participant's tile. No registry, no Socket.IO, no host roles, no remote media — those are deferred (Subtasks 2/3, master spec).

**Tech Stack:** Backend — Node.js 22, TypeScript (ESM, strict), Express 4, `livekit-server-sdk`, `pino`, `zod`, Vitest + Supertest. Frontend — React 18, TypeScript, Vite, Tailwind CSS, Zustand, react-i18next, `@livekit/components-react` + `livekit-client`, Vitest + Testing Library.

## Global Constraints

- **Spec is binding:** `docs/superpowers/specs/subtasks/01-join-room.md`. The PRD (`prd-kmb-video-chat.md` v2.0) + wireframes are the source of truth for product behavior and **verbatim** UI strings.
- **English only** in code/comments/docs. User-facing strings localized EN (default) / RU via react-i18next — **no hardcoded user-facing strings in components**; every string goes through `t()`.
- **TypeScript strict.** No `any`; `unknown` + guards instead. No inline `// eslint-disable`, no `// @ts-ignore`/`@ts-expect-error` without a one-line justification. `tsc --noEmit` and ESLint must be clean (zero warnings) for a task to be "done".
- **Naming:** types/interfaces/components `PascalCase`, **no `I`-prefix**; variables/functions `camelCase`; constants `UPPER_SNAKE_CASE`. String-literal unions over `enum`. Named exports only (except where a tool requires default, e.g. Vite/Tailwind config). `import type` for type-only imports. Explicit return types on module/API-boundary functions.
- **No `console.*`** anywhere except `backend/src/logger.ts`. Config from env only; never hardcode secrets; validate required env at startup and fail fast.
- **Authority is server-side.** Capacity and name validation are re-checked at the join boundary; the frontend mirrors them for UX only.
- **Frontend layout is feature-based**; a feature imports from `shared/`/`stores/` only, never another feature's internals. **One Zustand store per concern** (no god store; no `useCallStore`). Components subscribe to the narrowest slice. Theme via Tailwind `dark:` (Dark default).
- **Capacity = 4** (`MAX_PARTICIPANTS`). **Fixed room name** from `FIXED_ROOM_NAME` (default `"main"`). **Name rule:** `^[\p{L}\p{N} '\-]{2,30}$`, trimmed before validation, input capped at 30. **Duplicate display names are allowed** (PRD Assumption 10) — identity is a separate server-generated `p_<random>` id; never derive identity from the name.
- **Tests co-located** (`*.test.ts(x)` next to source), behavior-first, deterministic (mock LiveKit/`getUserMedia`; no real services).
- **Commit frequently** — one commit per task at minimum, using Conventional Commits (`feat:`, `test:`, `chore:`).

---

## File Structure

### Backend (`backend/`)

| File | Responsibility |
| --- | --- |
| `package.json` | ESM + TS, deps, scripts (`dev`/`build`/`lint`/`typecheck`/`test`) |
| `tsconfig.json` | Strict TS, ESM, `noEmit` for typecheck |
| `eslint.config.js` | Flat ESLint config (typescript-eslint, no-console) |
| `vitest.config.ts` | Vitest node environment |
| `.env.example` | Documented env vars (real `.env` is gitignored) |
| `src/config.ts` | Load + validate env (zod), fail fast; exposes `AppConfig` incl. `FIXED_ROOM_NAME`, `MAX_PARTICIPANTS` |
| `src/logger.ts` | The single `pino` logger (only file allowed to touch `console`/stdout) |
| `src/errors.ts` | `AppError` with stable `code`; HTTP mapping helper |
| `src/validation.ts` | `validateDisplayName(raw)` → typed result |
| `src/identity.ts` | `generateIdentity()` → `p_<random>` |
| `src/livekitTokens.ts` | `mintGuestToken({ identity, displayName, room })` → JWT (no `roomAdmin`) |
| `src/livekitAdmin.ts` | `createLivekitAdmin(config)`: `ensureRoom()`, `listParticipants(room)` |
| `src/app.ts` | `createApp(deps)` → Express app with the two routes (DI for tests) |
| `src/server.ts` | Composition root: build real deps, `ensureRoom()`, start HTTP server |

### Frontend (`frontend/` — created via Vite in Task 11)

| File | Responsibility |
| --- | --- |
| `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx` | Vite React-TS scaffold |
| `tailwind.config.js`, `postcss.config.js`, `src/index.css` | Tailwind, Dark default, theme tokens |
| `eslint.config.js` | Flat config + `eslint-plugin-boundaries` (feature isolation) |
| `.env.example`, `src/vite-env.d.ts` | `VITE_API_BASE_URL` |
| `src/shared/i18n/index.ts`, `en.ts`, `ru.ts` | i18next init + EN/RU resources (namespaced) |
| `src/shared/types/index.ts` | Cross-cutting types (`JoinResponse`, `RoomStatus`, …) |
| `src/shared/lib/apiClient.ts` | `getRoomStatus()`, `joinRoom(name)` |
| `src/shared/ui/Button.tsx`, `Toggle.tsx`, `Spinner.tsx` | Presentational primitives |
| `src/stores/useUiStore.ts` | theme/language UI state |
| `src/stores/useMediaStore.ts` | local mic/cam on-off + device-permission state |
| `src/stores/useConnectionStore.ts` | connection phase + local participant |
| `src/features/prejoin/` | `PreJoinScreen.tsx`, `components/{CameraPreview,DeviceToggles,NameField}.tsx`, `hooks/{useNameValidation,useDevicePermissions}.ts`, `index.ts` |
| `src/features/room-states/` | `CallFullScreen.tsx` (S1), `index.ts` |
| `src/features/call/` | `CallShell.tsx`, `components/{OwnTile,ControlsBar,ConnectingScreen}.tsx`, `index.ts` |
| `src/App.tsx` | Top-level routing: capacity check → S1 / pre-join / connecting / in-call |

---

# Phase A — Backend

## Task 1: Backend project setup

**Files:**
- Modify: `backend/package.json`
- Create: `backend/tsconfig.json`, `backend/eslint.config.js`, `backend/vitest.config.ts`, `backend/.env.example`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `typecheck`, `lint`, `lint:fix`, `test`; toolchain for all later backend tasks.

- [ ] **Step 1: Replace `backend/package.json`**

```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "kmb-video-chat control plane",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "license": "ISC"
}
```

- [ ] **Step 2: Install dependencies**

Run (in `backend/`):
```bash
npm install express cors livekit-server-sdk pino zod
npm install -D typescript tsx vitest supertest \
  @types/node @types/express @types/cors @types/supertest \
  eslint @eslint/js typescript-eslint
```
Expected: `node_modules/` populated, no peer-dep errors.

- [ ] **Step 3: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `backend/eslint.config.js`**

```js
// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The logger is the only place allowed to touch the console.
    files: ['src/logger.ts'],
    rules: { 'no-console': 'off' },
  },
);
```

- [ ] **Step 5: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 6: Create `backend/.env.example`**

```bash
# LiveKit local server (run: livekit-server --dev)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
# ws/wss URL the browser connects to
LIVEKIT_URL=ws://localhost:7880
# http(s) URL the backend uses for the RoomServiceClient admin API
LIVEKIT_HOST=http://localhost:7880

# Control plane
PORT=3000
FIXED_ROOM_NAME=main
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 7: Verify toolchain & commit**

Run: `cd backend && npm run lint`
Expected: PASS (no files yet to lint → exit 0; if ESLint complains about no files, that is acceptable).
```bash
git add backend/package.json backend/tsconfig.json backend/eslint.config.js backend/vitest.config.ts backend/.env.example
git commit -m "chore(backend): set up TypeScript + ESLint + Vitest toolchain"
```

---

## Task 2: `config.ts` — env loading & validation

**Files:**
- Create: `backend/src/config.ts`, `backend/src/config.test.ts`

**Interfaces:**
- Produces:
  - `type AppConfig = { livekitApiKey: string; livekitApiSecret: string; livekitUrl: string; livekitHost: string; port: number; corsOrigin: string; fixedRoomName: string; maxParticipants: number; emptyTimeoutSeconds: number }`
  - `loadConfig(env: NodeJS.ProcessEnv): AppConfig` — throws on missing/invalid required vars.
  - const `MAX_PARTICIPANTS = 4`.

- [ ] **Step 1: Write the failing test (`backend/src/config.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig, MAX_PARTICIPANTS } from './config.js';

const base = {
  LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's',
  LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_HOST: 'http://localhost:7880',
};

describe('loadConfig', () => {
  it('parses a valid env with defaults', () => {
    const cfg = loadConfig(base);
    expect(cfg.fixedRoomName).toBe('main');
    expect(cfg.port).toBe(3000);
    expect(cfg.maxParticipants).toBe(MAX_PARTICIPANTS);
    expect(cfg.maxParticipants).toBe(4);
  });

  it('throws when a required LiveKit var is missing', () => {
    expect(() => loadConfig({ ...base, LIVEKIT_API_KEY: undefined })).toThrow();
  });

  it('honours FIXED_ROOM_NAME and PORT overrides', () => {
    const cfg = loadConfig({ ...base, FIXED_ROOM_NAME: 'demo', PORT: '4000' });
    expect(cfg.fixedRoomName).toBe('demo');
    expect(cfg.port).toBe(4000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/config.test.ts`
Expected: FAIL — cannot resolve `./config.js`.

- [ ] **Step 3: Implement `backend/src/config.ts`**

```ts
import { z } from 'zod';

export const MAX_PARTICIPANTS = 4;

const EMPTY_TIMEOUT_SECONDS = 300;

const envSchema = z.object({
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_URL: z.string().min(1),
  LIVEKIT_HOST: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FIXED_ROOM_NAME: z.string().min(1).default('main'),
});

export type AppConfig = {
  livekitApiKey: string;
  livekitApiSecret: string;
  livekitUrl: string;
  livekitHost: string;
  port: number;
  corsOrigin: string;
  fixedRoomName: string;
  maxParticipants: number;
  emptyTimeoutSeconds: number;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  return {
    livekitApiKey: e.LIVEKIT_API_KEY,
    livekitApiSecret: e.LIVEKIT_API_SECRET,
    livekitUrl: e.LIVEKIT_URL,
    livekitHost: e.LIVEKIT_HOST,
    port: e.PORT,
    corsOrigin: e.CORS_ORIGIN,
    fixedRoomName: e.FIXED_ROOM_NAME,
    maxParticipants: MAX_PARTICIPANTS,
    emptyTimeoutSeconds: EMPTY_TIMEOUT_SECONDS,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/config.ts backend/src/config.test.ts
git commit -m "feat(backend): add env config loading with validation"
```

---

## Task 3: `logger.ts` — single application logger

**Files:**
- Create: `backend/src/logger.ts`

**Interfaces:**
- Produces: `logger` (a `pino` instance). Only file allowed to use `console`/process stdout.

- [ ] **Step 1: Implement `backend/src/logger.ts`**

```ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});
```

- [ ] **Step 2: Install pino**

Run: `cd backend && npm install pino`
Expected: pino added to dependencies.

- [ ] **Step 3: Verify typecheck & commit**

Run: `cd backend && npm run typecheck`
Expected: PASS.
```bash
git add backend/src/logger.ts backend/package.json
git commit -m "feat(backend): add application logger"
```

---

## Task 4: `errors.ts` — typed application errors

**Files:**
- Create: `backend/src/errors.ts`, `backend/src/errors.test.ts`

**Interfaces:**
- Produces:
  - `type ErrorCode = 'FULL' | 'INVALID_NAME' | 'INTERNAL'`
  - `class AppError extends Error { code: ErrorCode; status: number }`
  - `httpStatusForCode(code: ErrorCode): number`

- [ ] **Step 1: Write the failing test (`backend/src/errors.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { AppError, httpStatusForCode } from './errors.js';

describe('AppError', () => {
  it('carries a stable code and an HTTP status', () => {
    const err = new AppError('FULL');
    expect(err.code).toBe('FULL');
    expect(err.status).toBe(409);
    expect(err).toBeInstanceOf(Error);
  });

  it('maps INVALID_NAME to 400', () => {
    expect(httpStatusForCode('INVALID_NAME')).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/errors.test.ts`
Expected: FAIL — cannot resolve `./errors.js`.

- [ ] **Step 3: Implement `backend/src/errors.ts`**

```ts
export type ErrorCode = 'FULL' | 'INVALID_NAME' | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  FULL: 409,
  INVALID_NAME: 400,
  INTERNAL: 500,
};

export function httpStatusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = httpStatusForCode(code);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/errors.ts backend/src/errors.test.ts
git commit -m "feat(backend): add typed AppError with HTTP mapping"
```

---

## Task 5: `validation.ts` — display-name validation

**Files:**
- Create: `backend/src/validation.ts`, `backend/src/validation.test.ts`

**Interfaces:**
- Produces:
  - `type NameValidation = { ok: true; value: string } | { ok: false; reason: 'empty' | 'length' | 'chars' }`
  - `validateDisplayName(raw: unknown): NameValidation` — trims, caps at 30 chars, applies `^[\p{L}\p{N} '\-]{2,30}$`.

- [ ] **Step 1: Write the failing test (`backend/src/validation.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { validateDisplayName } from './validation.js';

describe('validateDisplayName', () => {
  it('accepts a normal name and returns the trimmed value', () => {
    expect(validateDisplayName('  Ann  ')).toEqual({ ok: true, value: 'Ann' });
  });

  it('accepts letters, numbers, spaces, hyphens and apostrophes', () => {
    expect(validateDisplayName("O'Neil-7 Ann")).toEqual({ ok: true, value: "O'Neil-7 Ann" });
  });

  it('accepts unicode letters', () => {
    expect(validateDisplayName('Анна')).toEqual({ ok: true, value: 'Анна' });
  });

  it('rejects empty / whitespace-only as empty', () => {
    expect(validateDisplayName('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateDisplayName('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects too-short (1 char) as length', () => {
    expect(validateDisplayName('A')).toEqual({ ok: false, reason: 'length' });
  });

  it('rejects too-long (>30) as length', () => {
    expect(validateDisplayName('a'.repeat(31))).toEqual({ ok: false, reason: 'length' });
  });

  it('rejects illegal characters', () => {
    expect(validateDisplayName('Ann@home')).toEqual({ ok: false, reason: 'chars' });
  });

  it('rejects non-string input as empty', () => {
    expect(validateDisplayName(undefined)).toEqual({ ok: false, reason: 'empty' });
    expect(validateDisplayName(42)).toEqual({ ok: false, reason: 'empty' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/validation.test.ts`
Expected: FAIL — cannot resolve `./validation.js`.

- [ ] **Step 3: Implement `backend/src/validation.ts`**

```ts
export type NameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'length' | 'chars' };

const NAME_PATTERN = /^[\p{L}\p{N} '\-]{2,30}$/u;
const MAX_NAME_LENGTH = 30;

export function validateDisplayName(raw: unknown): NameValidation {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  // Input is capped at 30 before the length check so a long paste reports `length`.
  const capped = trimmed.slice(0, MAX_NAME_LENGTH);
  if (trimmed.length > MAX_NAME_LENGTH || capped.length < 2) {
    return { ok: false, reason: 'length' };
  }
  if (!NAME_PATTERN.test(capped)) return { ok: false, reason: 'chars' };
  return { ok: true, value: capped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/validation.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/validation.ts backend/src/validation.test.ts
git commit -m "feat(backend): add display-name validation"
```

---

## Task 6: `identity.ts` — server-generated participant identity

**Files:**
- Create: `backend/src/identity.ts`, `backend/src/identity.test.ts`

**Interfaces:**
- Produces: `generateIdentity(): string` → `p_<random>` (unique, not derived from name).

- [ ] **Step 1: Write the failing test (`backend/src/identity.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { generateIdentity } from './identity.js';

describe('generateIdentity', () => {
  it('produces a p_ prefixed id', () => {
    expect(generateIdentity()).toMatch(/^p_[a-z0-9-]+$/i);
  });

  it('produces a unique id each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateIdentity()));
    expect(ids.size).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/identity.test.ts`
Expected: FAIL — cannot resolve `./identity.js`.

- [ ] **Step 3: Implement `backend/src/identity.ts`**

```ts
import { randomUUID } from 'node:crypto';

export function generateIdentity(): string {
  return `p_${randomUUID()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/identity.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/identity.ts backend/src/identity.test.ts
git commit -m "feat(backend): add server-generated participant identity"
```

---

## Task 7: `livekitTokens.ts` — mint guest access token

**Files:**
- Create: `backend/src/livekitTokens.ts`, `backend/src/livekitTokens.test.ts`

**Interfaces:**
- Consumes: `AppConfig` (api key/secret).
- Produces:
  - `type GuestTokenInput = { identity: string; displayName: string; room: string }`
  - `createTokenMinter(config: Pick<AppConfig, 'livekitApiKey' | 'livekitApiSecret'>): { mintGuestToken(input: GuestTokenInput): Promise<string> }`

- [ ] **Step 1: Write the failing test (`backend/src/livekitTokens.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { createTokenMinter } from './livekitTokens.js';

describe('createTokenMinter', () => {
  const minter = createTokenMinter({ livekitApiKey: 'devkey', livekitApiSecret: 'secret-secret-secret' });

  it('mints a JWT (three dot-separated segments)', async () => {
    const jwt = await minter.mintGuestToken({ identity: 'p_1', displayName: 'Ann', room: 'main' });
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('encodes the identity and grants in the payload (no roomAdmin)', async () => {
    const jwt = await minter.mintGuestToken({ identity: 'p_1', displayName: 'Ann', room: 'main' });
    const payloadPart = jwt.split('.')[1] ?? '';
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    expect(payload.sub).toBe('p_1');
    expect(payload.video.room).toBe('main');
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.canPublish).toBe(true);
    expect(payload.video.canSubscribe).toBe(true);
    expect(payload.video.roomAdmin).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/livekitTokens.test.ts`
Expected: FAIL — cannot resolve `./livekitTokens.js`.

- [ ] **Step 3: Implement `backend/src/livekitTokens.ts`**

```ts
import { AccessToken } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';

export type GuestTokenInput = {
  identity: string;
  displayName: string;
  room: string;
};

export type TokenMinter = {
  mintGuestToken(input: GuestTokenInput): Promise<string>;
};

export function createTokenMinter(
  config: Pick<AppConfig, 'livekitApiKey' | 'livekitApiSecret'>,
): TokenMinter {
  return {
    async mintGuestToken({ identity, displayName, room }) {
      const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
        identity,
        name: displayName,
      });
      at.addGrant({
        roomJoin: true,
        room,
        canPublish: true,
        canSubscribe: true,
        // No roomAdmin: guests cannot perform host actions (deferred to master spec).
      });
      return at.toJwt();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/livekitTokens.test.ts`
Expected: PASS (2 tests).

> If the installed `livekit-server-sdk` major version returns a string synchronously from `toJwt()`, the `async`/`await` still resolves correctly — leave the signature `Promise<string>`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/livekitTokens.ts backend/src/livekitTokens.test.ts
git commit -m "feat(backend): mint LiveKit guest access tokens"
```

---

## Task 8: `livekitAdmin.ts` — room provisioning & live count

**Files:**
- Create: `backend/src/livekitAdmin.ts`

**Interfaces:**
- Consumes: `AppConfig`.
- Produces:
  - `type LivekitAdmin = { ensureRoom(): Promise<void>; listParticipantCount(): Promise<number> }`
  - `createLivekitAdmin(config: AppConfig): LivekitAdmin`

> No co-located unit test: this is a thin wrapper over `RoomServiceClient` (network I/O). Its behavior is exercised through `app.ts` (Task 9) with a mocked admin. Keep it free of branching logic so there is nothing to unit-test in isolation.

- [ ] **Step 1: Implement `backend/src/livekitAdmin.ts`**

```ts
import { RoomServiceClient } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';

export type LivekitAdmin = {
  ensureRoom(): Promise<void>;
  listParticipantCount(): Promise<number>;
};

export function createLivekitAdmin(config: AppConfig): LivekitAdmin {
  const client = new RoomServiceClient(
    config.livekitHost,
    config.livekitApiKey,
    config.livekitApiSecret,
  );

  return {
    async ensureRoom() {
      // Idempotent: createRoom on an existing room is a no-op upsert.
      await client.createRoom({
        name: config.fixedRoomName,
        maxParticipants: config.maxParticipants,
        emptyTimeout: config.emptyTimeoutSeconds,
      });
      logger.info({ room: config.fixedRoomName }, 'ensured fixed room exists');
    },

    async listParticipantCount() {
      const participants = await client.listParticipants(config.fixedRoomName);
      return participants.length;
    },
  };
}
```

- [ ] **Step 2: Verify typecheck & commit**

Run: `cd backend && npm run typecheck`
Expected: PASS.
```bash
git add backend/src/livekitAdmin.ts
git commit -m "feat(backend): add LiveKit admin (ensureRoom + live count)"
```

---

## Task 9: `app.ts` — REST routes (capacity gate + join)

**Files:**
- Create: `backend/src/app.ts`, `backend/src/app.test.ts`

**Interfaces:**
- Consumes: `validateDisplayName`, `generateIdentity`, `AppError`, `httpStatusForCode`, `TokenMinter`, `LivekitAdmin`, `AppConfig`.
- Produces:
  - `type AppDeps = { config: AppConfig; admin: Pick<LivekitAdmin, 'listParticipantCount'>; minter: TokenMinter }`
  - `createApp(deps: AppDeps): Express` exposing:
    - `GET /rooms/:roomName` → `{ status: 'available' | 'full' }`
    - `POST /rooms/:roomName/join` (body `{ name }`) → `{ accessToken, livekitUrl, role: 'guest', identity, displayName }` or `{ error: ErrorCode }`

- [ ] **Step 1: Write the failing test (`backend/src/app.test.ts`)**

```ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';

const config: AppConfig = {
  livekitApiKey: 'k', livekitApiSecret: 's',
  livekitUrl: 'ws://localhost:7880', livekitHost: 'http://localhost:7880',
  port: 3000, corsOrigin: '*', fixedRoomName: 'main',
  maxParticipants: 4, emptyTimeoutSeconds: 300,
};

function makeApp(count: number) {
  const admin = { listParticipantCount: vi.fn().mockResolvedValue(count) };
  const minter = { mintGuestToken: vi.fn().mockResolvedValue('jwt.token.value') };
  return { app: createApp({ config, admin, minter }), admin, minter };
}

describe('GET /rooms/:roomName', () => {
  it('returns available below capacity', async () => {
    const { app } = makeApp(3);
    const res = await request(app).get('/rooms/main');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'available' });
  });

  it('returns full at capacity', async () => {
    const { app } = makeApp(4);
    const res = await request(app).get('/rooms/main');
    expect(res.body).toEqual({ status: 'full' });
  });
});

describe('POST /rooms/:roomName/join', () => {
  it('issues a guest token below capacity', async () => {
    const { app, minter } = makeApp(0);
    const res = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: 'jwt.token.value',
      livekitUrl: 'ws://localhost:7880',
      role: 'guest',
      displayName: 'Ann',
    });
    expect(res.body.identity).toMatch(/^p_/);
    expect(minter.mintGuestToken).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ann', room: 'main' }),
    );
  });

  it('rejects join at capacity with FULL', async () => {
    const { app } = makeApp(4);
    const res = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'FULL' });
  });

  it('rejects an invalid name with INVALID_NAME', async () => {
    const { app } = makeApp(0);
    const res = await request(app).post('/rooms/main/join').send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_NAME' });
  });

  it('allows duplicate display names with distinct identities', async () => {
    const { app } = makeApp(1);
    const a = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    const b = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    expect(a.body.displayName).toBe('Ann');
    expect(b.body.displayName).toBe('Ann');
    expect(a.body.identity).not.toBe(b.body.identity);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/app.test.ts`
Expected: FAIL — cannot resolve `./app.js`.

- [ ] **Step 3: Implement `backend/src/app.ts`**

```ts
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import type { AppConfig } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { TokenMinter } from './livekitTokens.js';
import { validateDisplayName } from './validation.js';
import { generateIdentity } from './identity.js';
import { AppError, type ErrorCode } from './errors.js';
import { logger } from './logger.js';

export type AppDeps = {
  config: AppConfig;
  admin: Pick<LivekitAdmin, 'listParticipantCount'>;
  minter: TokenMinter;
};

export function createApp(deps: AppDeps): Express {
  const { config, admin, minter } = deps;
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/rooms/:roomName', (req, res, next) => {
    void handleStatus(req, res).catch(next);
  });

  app.post('/rooms/:roomName/join', (req, res, next) => {
    void handleJoin(req, res).catch(next);
  });

  async function handleStatus(_req: Request, res: Response): Promise<void> {
    const count = await admin.listParticipantCount();
    res.json({ status: count >= config.maxParticipants ? 'full' : 'available' });
  }

  async function handleJoin(req: Request, res: Response): Promise<void> {
    const count = await admin.listParticipantCount();
    if (count >= config.maxParticipants) throw new AppError('FULL');

    const nameResult = validateDisplayName((req.body as { name?: unknown })?.name);
    if (!nameResult.ok) throw new AppError('INVALID_NAME');

    const identity = generateIdentity();
    const accessToken = await minter.mintGuestToken({
      identity,
      displayName: nameResult.value,
      room: config.fixedRoomName,
    });

    res.json({
      accessToken,
      livekitUrl: config.livekitUrl,
      role: 'guest',
      identity,
      displayName: nameResult.value,
    });
  }

  // Error edge: map AppError to {status, {error: code}}; never leak internals.
  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.code satisfies ErrorCode });
      return;
    }
    logger.error({ err }, 'unhandled error in request');
    res.status(500).json({ error: 'INTERNAL' });
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/app.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run full backend lint + typecheck**

Run: `cd backend && npm run typecheck && npm run lint`
Expected: PASS, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.ts backend/src/app.test.ts
git commit -m "feat(backend): add room status + join routes with capacity gate"
```

---

## Task 10: `server.ts` — composition root

**Files:**
- Create: `backend/src/server.ts`

**Interfaces:**
- Consumes: `loadConfig`, `createLivekitAdmin`, `createTokenMinter`, `createApp`, `logger`.
- Produces: process entrypoint (`npm run dev` / `npm start`).

- [ ] **Step 1: Implement `backend/src/server.ts`**

```ts
import { loadConfig } from './config.js';
import { createLivekitAdmin } from './livekitAdmin.js';
import { createTokenMinter } from './livekitTokens.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const admin = createLivekitAdmin(config);
  const minter = createTokenMinter(config);

  await admin.ensureRoom();

  const app = createApp({ config, admin, minter });
  app.listen(config.port, () => {
    logger.info({ port: config.port, room: config.fixedRoomName }, 'control plane listening');
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'fatal startup error');
  process.exitCode = 1;
});
```

- [ ] **Step 2: Smoke-test against a local LiveKit (manual)**

Run (terminal 1): `livekit-server --dev`
Run (terminal 2): `cd backend && cp .env.example .env && npm run dev`
Then: `curl http://localhost:3000/rooms/main`
Expected: `{"status":"available"}`. Then:
`curl -X POST http://localhost:3000/rooms/main/join -H "Content-Type: application/json" -d '{"name":"Ann"}'`
Expected: JSON with `accessToken`, `role: "guest"`, `identity` starting `p_`.

- [ ] **Step 3: Run full backend suite + commit**

Run: `cd backend && npm test && npm run typecheck && npm run lint`
Expected: all PASS.
```bash
git add backend/src/server.ts
git commit -m "feat(backend): wire composition root and start HTTP server"
```

---

# Phase B — Frontend foundation

## Task 11: Vite + Tailwind scaffold (Dark default)

**Files:**
- Create: `frontend/` (Vite react-ts), `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css`, `frontend/.env.example`
- Modify: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/index.html`

**Interfaces:**
- Produces: a running Vite dev app at `:5173` with Tailwind, dark theme applied to `<html>`, scripts `dev`/`build`/`typecheck`/`lint`/`test`.

- [ ] **Step 1: Scaffold Vite**

Run (in repo root):
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```
Expected: `frontend/` created with React + TS template.

- [ ] **Step 2: Install runtime + dev deps**

Run (in `frontend/`):
```bash
npm install zustand i18next react-i18next \
  @livekit/components-react @livekit/components-styles livekit-client
npm install -D tailwindcss@3 postcss autoprefixer \
  eslint-plugin-boundaries \
  vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npx tailwindcss init -p
```
Expected: Tailwind + PostCSS configs created.

- [ ] **Step 3: Configure `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0f1117', muted: '#1a1d27' },
        accent: { DEFAULT: '#4f7cff' },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Replace `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-white text-slate-900 dark:bg-surface dark:text-slate-100; }
```

- [ ] **Step 5: Set Dark as default on the document — replace `frontend/index.html`'s `<html>` tag**

In `frontend/index.html`, change `<html lang="en">` to:
```html
<html lang="en" class="dark">
```

- [ ] **Step 6: Replace `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Replace `frontend/src/App.tsx` with a placeholder (real routing in Task 22)**

```tsx
export function App(): JSX.Element {
  return <div className="grid h-full place-items-center">kmb-video-chat</div>;
}
```

- [ ] **Step 8: Add scripts to `frontend/package.json`**

Ensure the `scripts` block contains:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 9: Add `frontend/.env.example`**

```bash
VITE_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 10: Add Vitest config to `frontend/vite.config.ts`**

Merge a `test` block into the existing config:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 11: Create `frontend/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 12: Verify dev server boots & commit**

Run: `cd frontend && npm run dev` (confirm it serves at `:5173`, then stop it), then `npm run typecheck`.
Expected: dev server boots, typecheck PASS.
```bash
git add frontend
git commit -m "chore(frontend): scaffold Vite + React + Tailwind (dark default)"
```

---

## Task 12: ESLint boundaries (feature isolation)

**Files:**
- Create/Modify: `frontend/eslint.config.js`

**Interfaces:**
- Produces: lint rules enforcing `features/*` cannot import another feature; `shared/*` imports only `shared`; `stores/*` imports `shared`.

- [ ] **Step 1: Write `frontend/eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import boundaries from 'eslint-plugin-boundaries';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/{App,main}.tsx', mode: 'file' },
        { type: 'feature', pattern: 'src/features/*', mode: 'folder' },
        { type: 'shared', pattern: 'src/shared/*', mode: 'folder' },
        { type: 'stores', pattern: 'src/stores/*', mode: 'folder' },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['feature', 'shared', 'stores'] },
          { from: 'feature', allow: ['shared', 'stores'] },
          { from: 'shared', allow: ['shared'] },
          { from: 'stores', allow: ['shared'] },
        ],
      }],
    },
  },
);
```

- [ ] **Step 2: Verify lint runs & commit**

Run: `cd frontend && npm run lint`
Expected: PASS (placeholder App only).
```bash
git add frontend/eslint.config.js
git commit -m "chore(frontend): enforce feature boundaries via eslint-plugin-boundaries"
```

---

## Task 13: i18n setup (EN/RU, verbatim strings)

**Files:**
- Create: `frontend/src/shared/i18n/en.ts`, `ru.ts`, `index.ts`

**Interfaces:**
- Produces: initialized i18next; namespaces `common`, `prejoin`, `call`, `roomStates`. Keys used by later tasks: see `en.ts`.

- [ ] **Step 1: Create `frontend/src/shared/i18n/en.ts`**

```ts
export const en = {
  common: {
    appName: 'kmb-video-chat',
    connecting: 'Connecting…',
    connectError: 'Unable to connect to the call service. Please check your internet connection and try again.',
  },
  prejoin: {
    nameLabel: 'Your name',
    nameHelp: '2–30 characters. Letters, numbers, spaces, hyphens and apostrophes.',
    enterCall: 'Enter call →',
    micToggle: 'Microphone',
    cameraToggle: 'Camera',
    awaitingPermission: 'Allow camera and microphone access to continue.',
    nameEmpty: 'Please enter your name',
    nameLength: 'Name must be 2–30 characters',
    nameChars: 'Name can contain only letters, numbers, spaces, hyphens and apostrophes',
    cameraDenied: 'Camera access was denied. You can enable it in your browser settings.',
    micDenied: 'Microphone access was denied. You can enable it in your browser settings.',
    bothDenied: 'Camera and microphone access was denied. You can enable them in your browser settings.',
  },
  call: {
    you: '{{name}} (You)',
    leave: 'Leave',
    micToggle: 'Microphone',
    cameraToggle: 'Camera',
  },
  roomStates: {
    fullTitle: 'This call is full.',
    fullBody: 'Only four participants can join at a time.',
    backToHome: 'Back to home',
  },
} as const;
```

- [ ] **Step 2: Create `frontend/src/shared/i18n/ru.ts`**

```ts
import type { en } from './en';

export const ru: typeof en = {
  common: {
    appName: 'kmb-video-chat',
    connecting: 'Подключение…',
    connectError: 'Не удалось подключиться к сервису звонков. Проверьте подключение к интернету и попробуйте снова.',
  },
  prejoin: {
    nameLabel: 'Ваше имя',
    nameHelp: '2–30 символов. Буквы, цифры, пробелы, дефисы и апострофы.',
    enterCall: 'Войти в звонок →',
    micToggle: 'Микрофон',
    cameraToggle: 'Камера',
    awaitingPermission: 'Разрешите доступ к камере и микрофону, чтобы продолжить.',
    nameEmpty: 'Пожалуйста, введите имя',
    nameLength: 'Имя должно содержать 2–30 символов',
    nameChars: 'Имя может содержать только буквы, цифры, пробелы, дефисы и апострофы',
    cameraDenied: 'Доступ к камере запрещён. Вы можете включить его в настройках браузера.',
    micDenied: 'Доступ к микрофону запрещён. Вы можете включить его в настройках браузера.',
    bothDenied: 'Доступ к камере и микрофону запрещён. Вы можете включить его в настройках браузера.',
  },
  call: {
    you: '{{name}} (Вы)',
    leave: 'Выйти',
    micToggle: 'Микрофон',
    cameraToggle: 'Камера',
  },
  roomStates: {
    fullTitle: 'Звонок заполнен.',
    fullBody: 'Одновременно могут участвовать только четыре человека.',
    backToHome: 'На главную',
  },
};
```

> EN strings are the binding verbatim source (spec §6). RU is the localized parallel; every key exists in both.

- [ ] **Step 3: Create `frontend/src/shared/i18n/index.ts`**

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { ru } from './ru';

export const i18nReady = i18n.use(initReactI18next).init({
  resources: { en: en, ru: ru },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'prejoin', 'call', 'roomStates'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 4: Import i18n in `frontend/src/main.tsx`**

Add the import near the top (after `./index.css`):
```tsx
import './shared/i18n';
```

- [ ] **Step 5: Verify typecheck & commit**

Run: `cd frontend && npm run typecheck`
Expected: PASS (RU typed as `typeof en` guarantees key parity).
```bash
git add frontend/src/shared/i18n frontend/src/main.tsx
git commit -m "feat(frontend): add i18n with verbatim EN/RU resources"
```

---

## Task 14: Zustand stores (UI, media, connection)

**Files:**
- Create: `frontend/src/stores/useUiStore.ts`, `useMediaStore.ts`, `useMediaStore.test.ts`, `useConnectionStore.ts`, `useConnectionStore.test.ts`

**Interfaces:**
- Produces:
  - `useUiStore` → `{ theme: 'dark' | 'light'; language: 'en' | 'ru'; setTheme; setLanguage }`
  - `useMediaStore` → `{ isMicOn: boolean; isCamOn: boolean; cameraPermission: PermissionState; micPermission: PermissionState; setMicOn; setCamOn; setCameraPermission; setMicPermission; reset }` where `type PermissionState = 'prompt' | 'granted' | 'denied'`
  - `useConnectionStore` → `{ phase: ConnectionPhase; localParticipant: LocalParticipant | null; setPhase; setLocalParticipant; reset }` where `type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'failed'`, `type LocalParticipant = { identity: string; displayName: string }`

- [ ] **Step 1: Create `frontend/src/stores/useUiStore.ts`**

```ts
import { create } from 'zustand';

type Theme = 'dark' | 'light';
type Language = 'en' | 'ru';

type UiState = {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
};

export const useUiStore = create<UiState>()((set) => ({
  theme: 'dark',
  language: 'en',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
```

- [ ] **Step 2: Write the failing test (`frontend/src/stores/useMediaStore.test.ts`)**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMediaStore } from './useMediaStore';

describe('useMediaStore', () => {
  beforeEach(() => useMediaStore.getState().reset());

  it('defaults mic and camera on', () => {
    const s = useMediaStore.getState();
    expect(s.isMicOn).toBe(true);
    expect(s.isCamOn).toBe(true);
    expect(s.cameraPermission).toBe('prompt');
  });

  it('toggles mic and camera', () => {
    useMediaStore.getState().setMicOn(false);
    useMediaStore.getState().setCamOn(false);
    expect(useMediaStore.getState().isMicOn).toBe(false);
    expect(useMediaStore.getState().isCamOn).toBe(false);
  });

  it('records device permission', () => {
    useMediaStore.getState().setCameraPermission('denied');
    expect(useMediaStore.getState().cameraPermission).toBe('denied');
  });

  it('reset restores defaults', () => {
    useMediaStore.getState().setMicOn(false);
    useMediaStore.getState().setCameraPermission('denied');
    useMediaStore.getState().reset();
    expect(useMediaStore.getState().isMicOn).toBe(true);
    expect(useMediaStore.getState().cameraPermission).toBe('prompt');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/stores/useMediaStore.test.ts`
Expected: FAIL — cannot resolve `./useMediaStore`.

- [ ] **Step 4: Create `frontend/src/stores/useMediaStore.ts`**

```ts
import { create } from 'zustand';

export type PermissionState = 'prompt' | 'granted' | 'denied';

type MediaState = {
  isMicOn: boolean;
  isCamOn: boolean;
  cameraPermission: PermissionState;
  micPermission: PermissionState;
  setMicOn: (on: boolean) => void;
  setCamOn: (on: boolean) => void;
  setCameraPermission: (state: PermissionState) => void;
  setMicPermission: (state: PermissionState) => void;
  reset: () => void;
};

const INITIAL = {
  isMicOn: true,
  isCamOn: true,
  cameraPermission: 'prompt' as PermissionState,
  micPermission: 'prompt' as PermissionState,
};

export const useMediaStore = create<MediaState>()((set) => ({
  ...INITIAL,
  setMicOn: (on) => set({ isMicOn: on }),
  setCamOn: (on) => set({ isCamOn: on }),
  setCameraPermission: (state) => set({ cameraPermission: state }),
  setMicPermission: (state) => set({ micPermission: state }),
  reset: () => set({ ...INITIAL }),
}));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/stores/useMediaStore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing test (`frontend/src/stores/useConnectionStore.test.ts`)**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from './useConnectionStore';

describe('useConnectionStore', () => {
  beforeEach(() => useConnectionStore.getState().reset());

  it('defaults to idle with no local participant', () => {
    expect(useConnectionStore.getState().phase).toBe('idle');
    expect(useConnectionStore.getState().localParticipant).toBeNull();
  });

  it('records phase and local participant', () => {
    useConnectionStore.getState().setPhase('connecting');
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_1', displayName: 'Ann' });
    expect(useConnectionStore.getState().phase).toBe('connecting');
    expect(useConnectionStore.getState().localParticipant?.displayName).toBe('Ann');
  });

  it('reset returns to idle', () => {
    useConnectionStore.getState().setPhase('connected');
    useConnectionStore.getState().reset();
    expect(useConnectionStore.getState().phase).toBe('idle');
    expect(useConnectionStore.getState().localParticipant).toBeNull();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/stores/useConnectionStore.test.ts`
Expected: FAIL — cannot resolve `./useConnectionStore`.

- [ ] **Step 8: Create `frontend/src/stores/useConnectionStore.ts`**

```ts
import { create } from 'zustand';

export type ConnectionPhase = 'idle' | 'connecting' | 'connected' | 'failed';
export type LocalParticipant = { identity: string; displayName: string };

type ConnectionState = {
  phase: ConnectionPhase;
  localParticipant: LocalParticipant | null;
  setPhase: (phase: ConnectionPhase) => void;
  setLocalParticipant: (participant: LocalParticipant | null) => void;
  reset: () => void;
};

export const useConnectionStore = create<ConnectionState>()((set) => ({
  phase: 'idle',
  localParticipant: null,
  setPhase: (phase) => set({ phase }),
  setLocalParticipant: (participant) => set({ localParticipant: participant }),
  reset: () => set({ phase: 'idle', localParticipant: null }),
}));
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/stores`
Expected: PASS (all store tests).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/stores
git commit -m "feat(frontend): add ui/media/connection Zustand stores"
```

---

## Task 15: Shared UI primitives

**Files:**
- Create: `frontend/src/shared/ui/Button.tsx`, `Toggle.tsx`, `Spinner.tsx`

**Interfaces:**
- Produces:
  - `Button` props: `{ children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost'; type?: 'button' | 'submit' }`
  - `Toggle` props: `{ label: string; pressed: boolean; disabled?: boolean; onChange: (pressed: boolean) => void }`
  - `Spinner` props: `{ label?: string }`

- [ ] **Step 1: Create `frontend/src/shared/ui/Button.tsx`**

```tsx
import type { ReactNode } from 'react';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
};

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button' }: ButtonProps): JSX.Element {
  const base = 'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent/90',
    ghost: 'bg-transparent text-slate-200 hover:bg-surface-muted',
  } as const;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Create `frontend/src/shared/ui/Toggle.tsx`**

```tsx
export type ToggleProps = {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onChange: (pressed: boolean) => void;
};

export function Toggle({ label, pressed, disabled, onChange }: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      className={`rounded-full px-4 py-2 text-sm transition disabled:opacity-40 ${
        pressed ? 'bg-accent text-white' : 'bg-surface-muted text-slate-300'
      }`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Create `frontend/src/shared/ui/Spinner.tsx`**

```tsx
export type SpinnerProps = { label?: string };

export function Spinner({ label }: SpinnerProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
      {label ? <span className="text-sm text-slate-300">{label}</span> : null}
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck & commit**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS.
```bash
git add frontend/src/shared/ui
git commit -m "feat(frontend): add Button/Toggle/Spinner UI primitives"
```

---

## Task 16: API client + shared types

**Files:**
- Create: `frontend/src/shared/types/index.ts`, `frontend/src/shared/lib/apiClient.ts`, `frontend/src/shared/lib/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `type RoomStatus = 'available' | 'full'`
  - `type JoinError = 'FULL' | 'INVALID_NAME' | 'INTERNAL'`
  - `type JoinResponse = { accessToken: string; livekitUrl: string; role: 'guest'; identity: string; displayName: string }`
  - `type JoinResult = { ok: true; data: JoinResponse } | { ok: false; error: JoinError }`
  - `getRoomStatus(roomName: string): Promise<RoomStatus>`
  - `joinRoom(roomName: string, name: string): Promise<JoinResult>`

- [ ] **Step 1: Create `frontend/src/shared/types/index.ts`**

```ts
export type RoomStatus = 'available' | 'full';
export type JoinError = 'FULL' | 'INVALID_NAME' | 'INTERNAL';

export type JoinResponse = {
  accessToken: string;
  livekitUrl: string;
  role: 'guest';
  identity: string;
  displayName: string;
};

export type JoinResult =
  | { ok: true; data: JoinResponse }
  | { ok: false; error: JoinError };
```

- [ ] **Step 2: Write the failing test (`frontend/src/shared/lib/apiClient.test.ts`)**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRoomStatus, joinRoom } from './apiClient';

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response));
}

describe('getRoomStatus', () => {
  it('returns the status field', async () => {
    mockFetch(200, { status: 'full' });
    expect(await getRoomStatus('main')).toBe('full');
  });
});

describe('joinRoom', () => {
  it('returns ok with data on success', async () => {
    const data = { accessToken: 'jwt', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann' };
    mockFetch(200, data);
    const result = await joinRoom('main', 'Ann');
    expect(result).toEqual({ ok: true, data });
  });

  it('returns the error code on 409 FULL', async () => {
    mockFetch(409, { error: 'FULL' });
    expect(await joinRoom('main', 'Ann')).toEqual({ ok: false, error: 'FULL' });
  });

  it('returns INVALID_NAME on 400', async () => {
    mockFetch(400, { error: 'INVALID_NAME' });
    expect(await joinRoom('main', 'A')).toEqual({ ok: false, error: 'INVALID_NAME' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/shared/lib/apiClient.test.ts`
Expected: FAIL — cannot resolve `./apiClient`.

- [ ] **Step 4: Create `frontend/src/shared/lib/apiClient.ts`**

```ts
import type { JoinError, JoinResponse, JoinResult, RoomStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function getRoomStatus(roomName: string): Promise<RoomStatus> {
  const res = await fetch(`${BASE_URL}/rooms/${encodeURIComponent(roomName)}`);
  const body = (await res.json()) as { status: RoomStatus };
  return body.status;
}

export async function joinRoom(roomName: string, name: string): Promise<JoinResult> {
  const res = await fetch(`${BASE_URL}/rooms/${encodeURIComponent(roomName)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    return { ok: true, data: (await res.json()) as JoinResponse };
  }
  const body = (await res.json().catch(() => ({}))) as { error?: JoinError };
  return { ok: false, error: body.error ?? 'INTERNAL' };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/shared/lib/apiClient.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/types frontend/src/shared/lib/apiClient.ts frontend/src/shared/lib/apiClient.test.ts
git commit -m "feat(frontend): add API client and shared types"
```

---

# Phase C — Frontend features

## Task 17: `useNameValidation` hook

**Files:**
- Create: `frontend/src/features/prejoin/hooks/useNameValidation.ts`, `useNameValidation.test.ts`

**Interfaces:**
- Produces:
  - `type NameValidity = { valid: boolean; errorKey: 'prejoin.nameEmpty' | 'prejoin.nameLength' | 'prejoin.nameChars' | null }`
  - `useNameValidation(name: string): NameValidity` (mirrors backend rule for UX; client never authoritative).

- [ ] **Step 1: Write the failing test (`frontend/src/features/prejoin/hooks/useNameValidation.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNameValidation } from './useNameValidation';

describe('useNameValidation', () => {
  it('flags empty input', () => {
    const { result } = renderHook(() => useNameValidation('   '));
    expect(result.current).toEqual({ valid: false, errorKey: 'prejoin.nameEmpty' });
  });

  it('flags too-short input as length', () => {
    const { result } = renderHook(() => useNameValidation('A'));
    expect(result.current.errorKey).toBe('prejoin.nameLength');
  });

  it('flags illegal characters', () => {
    const { result } = renderHook(() => useNameValidation('Ann@home'));
    expect(result.current.errorKey).toBe('prejoin.nameChars');
  });

  it('accepts a valid name', () => {
    const { result } = renderHook(() => useNameValidation("O'Neil-7"));
    expect(result.current).toEqual({ valid: true, errorKey: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/prejoin/hooks/useNameValidation.test.ts`
Expected: FAIL — cannot resolve `./useNameValidation`.

- [ ] **Step 3: Create `frontend/src/features/prejoin/hooks/useNameValidation.ts`**

```ts
import { useMemo } from 'react';

export type NameErrorKey = 'prejoin.nameEmpty' | 'prejoin.nameLength' | 'prejoin.nameChars';
export type NameValidity = { valid: boolean; errorKey: NameErrorKey | null };

const NAME_PATTERN = /^[\p{L}\p{N} '\-]{2,30}$/u;
const MAX_NAME_LENGTH = 30;

export function useNameValidation(name: string): NameValidity {
  return useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { valid: false, errorKey: 'prejoin.nameEmpty' };
    const capped = trimmed.slice(0, MAX_NAME_LENGTH);
    if (trimmed.length > MAX_NAME_LENGTH || capped.length < 2) {
      return { valid: false, errorKey: 'prejoin.nameLength' };
    }
    if (!NAME_PATTERN.test(capped)) return { valid: false, errorKey: 'prejoin.nameChars' };
    return { valid: true, errorKey: null };
  }, [name]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/prejoin/hooks/useNameValidation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/prejoin/hooks/useNameValidation.ts frontend/src/features/prejoin/hooks/useNameValidation.test.ts
git commit -m "feat(frontend): add client-side name validation hook"
```

---

## Task 18: `useDevicePermissions` hook (camera/mic preview)

**Files:**
- Create: `frontend/src/features/prejoin/hooks/useDevicePermissions.ts`, `useDevicePermissions.test.ts`

**Interfaces:**
- Consumes: `useMediaStore` (`setCameraPermission`, `setMicPermission`).
- Produces:
  - `useDevicePermissions(): { previewStream: MediaStream | null; cameraPermission: PermissionState; micPermission: PermissionState }`
  - On mount: requests `getUserMedia({ video, audio })`; on success → both `granted` + stream; on `NotAllowedError` → both `denied`; stops tracks on unmount.

> Behavior tested via store side-effects with a mocked `navigator.mediaDevices.getUserMedia`. The returned stream rendering is covered by the component test in Task 19.

- [ ] **Step 1: Write the failing test (`frontend/src/features/prejoin/hooks/useDevicePermissions.test.ts`)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDevicePermissions } from './useDevicePermissions';
import { useMediaStore } from '../../../stores/useMediaStore';

function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

beforeEach(() => useMediaStore.getState().reset());

describe('useDevicePermissions', () => {
  it('marks permissions granted when getUserMedia resolves', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().cameraPermission).toBe('granted'));
    expect(useMediaStore.getState().micPermission).toBe('granted');
  });

  it('marks permissions denied on NotAllowedError', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(err) } });
    renderHook(() => useDevicePermissions());
    await waitFor(() => expect(useMediaStore.getState().cameraPermission).toBe('denied'));
    expect(useMediaStore.getState().micPermission).toBe('denied');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/prejoin/hooks/useDevicePermissions.test.ts`
Expected: FAIL — cannot resolve `./useDevicePermissions`.

- [ ] **Step 3: Create `frontend/src/features/prejoin/hooks/useDevicePermissions.ts`**

```ts
import { useEffect, useState } from 'react';
import { useMediaStore, type PermissionState } from '../../../stores/useMediaStore';

export type DevicePermissions = {
  previewStream: MediaStream | null;
  cameraPermission: PermissionState;
  micPermission: PermissionState;
};

export function useDevicePermissions(): DevicePermissions {
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);
  const micPermission = useMediaStore((s) => s.micPermission);
  const setCameraPermission = useMediaStore((s) => s.setCameraPermission);
  const setMicPermission = useMediaStore((s) => s.setMicPermission);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    void navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setPreviewStream(s);
        setCameraPermission('granted');
        setMicPermission('granted');
      })
      .catch(() => {
        if (!active) return;
        setCameraPermission('denied');
        setMicPermission('denied');
      });

    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [setCameraPermission, setMicPermission]);

  return { previewStream, cameraPermission, micPermission };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/prejoin/hooks/useDevicePermissions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/prejoin/hooks/useDevicePermissions.ts frontend/src/features/prejoin/hooks/useDevicePermissions.test.ts
git commit -m "feat(frontend): add device-permission/preview hook"
```

---

## Task 19: Pre-join feature (preview, toggles, name field, screen)

**Files:**
- Create: `frontend/src/features/prejoin/components/CameraPreview.tsx`, `DeviceToggles.tsx`, `NameField.tsx`, `frontend/src/features/prejoin/PreJoinScreen.tsx`, `frontend/src/features/prejoin/index.ts`, `frontend/src/features/prejoin/PreJoinScreen.test.tsx`

**Interfaces:**
- Consumes: `useDevicePermissions`, `useNameValidation`, `useMediaStore`, `Button`, `Toggle`, i18n.
- Produces:
  - `PreJoinScreenProps = { onEnter: (name: string) => void; submitting?: boolean }`
  - `PreJoinScreen` (exported from `features/prejoin`): renders preview + toggles + name field + "Enter call →" (disabled until name valid).

- [ ] **Step 1: Create `frontend/src/features/prejoin/components/CameraPreview.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaStore } from '../../../stores/useMediaStore';

export type CameraPreviewProps = { stream: MediaStream | null };

export function CameraPreview({ stream }: CameraPreviewProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  const videoRef = useRef<HTMLVideoElement>(null);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const showVideo = isCamOn && cameraPermission === 'granted' && stream;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {showVideo ? (
        // Mirrored local preview (PRD FR-11).
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
      ) : (
        // Camera off / denied: mic-state icon centered on dark background, no avatar, no name.
        <div className="grid h-full place-items-center text-slate-400">
          <span aria-label={t('cameraToggle')} className="text-4xl">{useMediaStore.getState().isMicOn ? '🎤' : '🔇'}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/features/prejoin/components/DeviceToggles.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../../shared/ui/Toggle';
import { useMediaStore } from '../../../stores/useMediaStore';

export function DeviceToggles(): JSX.Element {
  const { t } = useTranslation('prejoin');
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const micPermission = useMediaStore((s) => s.micPermission);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);

  return (
    <div className="flex gap-3">
      <Toggle label={t('micToggle')} pressed={isMicOn} disabled={micPermission === 'denied'} onChange={setMicOn} />
      <Toggle label={t('cameraToggle')} pressed={isCamOn} disabled={cameraPermission === 'denied'} onChange={setCamOn} />
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/features/prejoin/components/NameField.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import type { NameErrorKey } from '../hooks/useNameValidation';

export type NameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  errorKey: NameErrorKey | null;
  showError: boolean;
};

export function NameField({ value, onChange, errorKey, showError }: NameFieldProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-300">{t('nameLabel')}</span>
      <input
        value={value}
        maxLength={30}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-surface-muted px-3 py-2 text-slate-100 outline-none focus:border-accent"
      />
      <span className="text-xs text-slate-500">{t('nameHelp')}</span>
      {showError && errorKey ? <span className="text-xs text-red-400">{t(errorKey)}</span> : null}
    </label>
  );
}
```

> `t(errorKey)` resolves keys like `prejoin.nameEmpty`; the `prejoin` namespace is the default for this `useTranslation('prejoin')` instance, so pass the bare key. Use `t(errorKey.replace('prejoin.', ''))` — see Step 4 wiring for the exact call.

- [ ] **Step 4: Create `frontend/src/features/prejoin/PreJoinScreen.tsx`**

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { useDevicePermissions } from './hooks/useDevicePermissions';
import { useNameValidation } from './hooks/useNameValidation';
import { useMediaStore } from '../../stores/useMediaStore';
import { CameraPreview } from './components/CameraPreview';
import { DeviceToggles } from './components/DeviceToggles';
import { NameField } from './components/NameField';

export type PreJoinScreenProps = {
  onEnter: (name: string) => void;
  submitting?: boolean;
};

export function PreJoinScreen({ onEnter, submitting = false }: PreJoinScreenProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  const { previewStream } = useDevicePermissions();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const { valid, errorKey } = useNameValidation(name);
  const cameraPermission = useMediaStore((s) => s.cameraPermission);
  const micPermission = useMediaStore((s) => s.micPermission);

  const bothDenied = cameraPermission === 'denied' && micPermission === 'denied';
  const localErrorKey = errorKey ? errorKey.replace('prejoin.', '') : null;

  function handleSubmit(): void {
    setTouched(true);
    if (valid && !submitting) onEnter(name.trim());
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-5 p-8">
      <CameraPreview stream={previewStream} />
      {cameraPermission === 'prompt' ? (
        <p className="text-sm text-slate-400">{t('awaitingPermission')}</p>
      ) : null}
      {cameraPermission === 'denied' && micPermission !== 'denied' ? (
        <p className="text-sm text-amber-400">{t('cameraDenied')}</p>
      ) : null}
      {micPermission === 'denied' && cameraPermission !== 'denied' ? (
        <p className="text-sm text-amber-400">{t('micDenied')}</p>
      ) : null}
      {bothDenied ? <p className="text-sm text-amber-400">{t('bothDenied')}</p> : null}
      <DeviceToggles />
      <NameField
        value={name}
        onChange={setName}
        errorKey={localErrorKey as never}
        showError={touched}
      />
      <Button type="button" onClick={handleSubmit} disabled={!valid || submitting}>
        {t('enterCall')}
      </Button>
    </div>
  );
}
```

> `NameField` uses `useTranslation('prejoin')` so it expects a bare key (`nameEmpty`). `localErrorKey` already strips the `prejoin.` prefix; the `as never` keeps the prop's literal-union type satisfied without widening to `string`.

- [ ] **Step 5: Create `frontend/src/features/prejoin/index.ts`**

```ts
export { PreJoinScreen } from './PreJoinScreen';
export type { PreJoinScreenProps } from './PreJoinScreen';
```

- [ ] **Step 6: Write the component test (`frontend/src/features/prejoin/PreJoinScreen.test.tsx`)**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../shared/i18n';
import { PreJoinScreen } from './PreJoinScreen';
import { useMediaStore } from '../../stores/useMediaStore';

function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

beforeEach(() => {
  useMediaStore.getState().reset();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
});

describe('PreJoinScreen', () => {
  it('disables Enter call until the name is valid', async () => {
    render(<PreJoinScreen onEnter={vi.fn()} />);
    const button = screen.getByRole('button', { name: /enter call/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('calls onEnter with the trimmed name', async () => {
    const onEnter = vi.fn();
    render(<PreJoinScreen onEnter={onEnter} />);
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Ann  ' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('Ann'));
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/prejoin`
Expected: PASS (all prejoin tests).

- [ ] **Step 8: Lint + typecheck + commit**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS.
```bash
git add frontend/src/features/prejoin
git commit -m "feat(frontend): add pre-join screen (preview, toggles, name)"
```

---

## Task 20: Room-states feature — `S1` "call full"

**Files:**
- Create: `frontend/src/features/room-states/CallFullScreen.tsx`, `index.ts`, `CallFullScreen.test.tsx`

**Interfaces:**
- Consumes: `Button`, i18n.
- Produces: `CallFullScreenProps = { onBackToHome: () => void }`; `CallFullScreen` exported from `features/room-states`.

- [ ] **Step 1: Create `frontend/src/features/room-states/CallFullScreen.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';

export type CallFullScreenProps = { onBackToHome: () => void };

export function CallFullScreen({ onBackToHome }: CallFullScreenProps): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">{t('fullTitle')}</h1>
      <p className="text-slate-400">{t('fullBody')}</p>
      <Button variant="ghost" onClick={onBackToHome}>{t('backToHome')}</Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/features/room-states/index.ts`**

```ts
export { CallFullScreen } from './CallFullScreen';
export type { CallFullScreenProps } from './CallFullScreen';
```

- [ ] **Step 3: Write the test (`frontend/src/features/room-states/CallFullScreen.test.tsx`)**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../shared/i18n';
import { CallFullScreen } from './CallFullScreen';

describe('CallFullScreen', () => {
  it('shows the verbatim full-call strings and fires back-to-home', () => {
    const onBack = vi.fn();
    render(<CallFullScreen onBackToHome={onBack} />);
    expect(screen.getByText('This call is full.')).toBeInTheDocument();
    expect(screen.getByText('Only four participants can join at a time.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to home' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/room-states`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/room-states
git commit -m "feat(frontend): add S1 call-full screen"
```

---

## Task 21: Call feature — connection hook + in-call shell (own tile)

**Files:**
- Create: `frontend/src/features/call/hooks/useLiveKitConnection.ts`, `frontend/src/features/call/components/ConnectingScreen.tsx`, `OwnTile.tsx`, `ControlsBar.tsx`, `frontend/src/features/call/CallShell.tsx`, `frontend/src/features/call/index.ts`, `frontend/src/features/call/components/ControlsBar.test.tsx`

**Interfaces:**
- Consumes: `@livekit/components-react` (`LiveKitRoom`, `useLocalParticipant`, `VideoTrack`, `useTracks`), `livekit-client` (`Track`), `useConnectionStore`, `useMediaStore`, `Button`, `Spinner`, i18n.
- Produces:
  - `CallShellProps = { accessToken: string; serverUrl: string; displayName: string; onLeave: () => void; onConnectError: () => void; onRoomFull: () => void }`
  - `CallShell` exported from `features/call` — wraps `<LiveKitRoom connect>` and renders own tile + controls; maps connect failures to `onRoomFull` (capacity backstop) / `onConnectError`.

- [ ] **Step 1: Create `frontend/src/features/call/components/ConnectingScreen.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../../shared/ui/Spinner';

export function ConnectingScreen(): JSX.Element {
  const { t } = useTranslation('common');
  return (
    <div className="grid min-h-full place-items-center">
      <Spinner label={t('connecting')} />
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/features/call/components/OwnTile.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { VideoTrack, useLocalParticipant, useTracks } from '@livekit/components-react';
import { useMediaStore } from '../../../stores/useMediaStore';

export type OwnTileProps = { displayName: string };

export function OwnTile({ displayName }: OwnTileProps): JSX.Element {
  const { t } = useTranslation('call');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const cameraTracks = useTracks([Track.Source.Camera]).filter(
    (ref) => ref.participant.identity === localParticipant.identity,
  );
  const cameraRef = cameraTracks[0];
  const showVideo = cameraRef && !cameraRef.publication?.isMuted;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {showVideo ? (
        <VideoTrack trackRef={cameraRef} className="h-full w-full -scale-x-100 object-cover" />
      ) : (
        // Camera off: mic-state icon + name on dark background, no avatar (PRD FR-14).
        <div className="grid h-full place-items-center text-slate-400">
          <span className="text-4xl">{isMicOn ? '🎤' : '🔇'}</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {t('you', { name: displayName })}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/features/call/components/ControlsBar.tsx`**

```tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalParticipant } from '@livekit/components-react';
import { Toggle } from '../../../shared/ui/Toggle';
import { Button } from '../../../shared/ui/Button';
import { useMediaStore } from '../../../stores/useMediaStore';

export type ControlsBarProps = { onLeave: () => void };

export function ControlsBar({ onLeave }: ControlsBarProps): JSX.Element {
  const { t } = useTranslation('call');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);

  // Reconcile published tracks with the store's desired state.
  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(isMicOn);
  }, [localParticipant, isMicOn]);
  useEffect(() => {
    void localParticipant.setCameraEnabled(isCamOn);
  }, [localParticipant, isCamOn]);

  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <Toggle label={t('micToggle')} pressed={isMicOn} onChange={setMicOn} />
      <Toggle label={t('cameraToggle')} pressed={isCamOn} onChange={setCamOn} />
      <Button variant="ghost" onClick={onLeave}>{t('leave')}</Button>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/features/call/CallShell.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import '@livekit/components-styles';
import { useConnectionStore } from '../../stores/useConnectionStore';
import { useMediaStore } from '../../stores/useMediaStore';
import { OwnTile } from './components/OwnTile';
import { ControlsBar } from './components/ControlsBar';

export type CallShellProps = {
  accessToken: string;
  serverUrl: string;
  displayName: string;
  onLeave: () => void;
  onConnectError: () => void;
  onRoomFull: () => void;
};

export function CallShell({
  accessToken,
  serverUrl,
  displayName,
  onLeave,
  onConnectError,
  onRoomFull,
}: CallShellProps): JSX.Element {
  const { t } = useTranslation('common');
  const setPhase = useConnectionStore((s) => s.setPhase);
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);

  function handleError(error: Error): void {
    // LiveKit rejects the surplus participant from the maxParticipants backstop → S1.
    if (/full|exceeds|maximum|capacity/i.test(error.message)) {
      onRoomFull();
      return;
    }
    setPhase('failed');
    onConnectError();
  }

  return (
    <LiveKitRoom
      token={accessToken}
      serverUrl={serverUrl}
      connect
      audio={isMicOn}
      video={isCamOn}
      onConnected={() => setPhase('connected')}
      onError={handleError}
      onDisconnected={onLeave}
      className="flex min-h-full flex-col"
    >
      <div className="flex flex-1 items-center justify-center p-6" aria-label={t('appName')}>
        {/* Subtask 3 replaces this single tile with the 2x2 remote grid. */}
        <div className="w-full max-w-2xl">
          <OwnTile displayName={displayName} />
        </div>
      </div>
      <ControlsBar onLeave={onLeave} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
```

- [ ] **Step 5: Create `frontend/src/features/call/index.ts`**

```ts
export { CallShell } from './CallShell';
export type { CallShellProps } from './CallShell';
export { ConnectingScreen } from './components/ConnectingScreen';
```

- [ ] **Step 6: Write a focused test for `ControlsBar` (`frontend/src/features/call/components/ControlsBar.test.tsx`)**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { useMediaStore } from '../../../stores/useMediaStore';

const setMicEnabled = vi.fn().mockResolvedValue(undefined);
const setCamEnabled = vi.fn().mockResolvedValue(undefined);

vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: setMicEnabled, setCameraEnabled: setCamEnabled },
  }),
}));

import { ControlsBar } from './ControlsBar';

beforeEach(() => {
  useMediaStore.getState().reset();
  setMicEnabled.mockClear();
  setCamEnabled.mockClear();
});

describe('ControlsBar', () => {
  it('fires onLeave when Leave is clicked', () => {
    const onLeave = vi.fn();
    render(<ControlsBar onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('reconciles mic state to the published track when toggled', () => {
    render(<ControlsBar onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }));
    expect(setMicEnabled).toHaveBeenLastCalledWith(false);
  });
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/call`
Expected: PASS (2 tests).

- [ ] **Step 8: Lint + typecheck + commit**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: PASS.
```bash
git add frontend/src/features/call
git commit -m "feat(frontend): add in-call shell with own tile and controls"
```

---

## Task 22: `App.tsx` — top-level routing & capacity flow

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `getRoomStatus`, `joinRoom`, `PreJoinScreen`, `CallFullScreen`, `CallShell`, `ConnectingScreen`, stores.
- Produces: the wired application — capacity check on load → `S1` / pre-join → connecting → in-call; Leave/Back-to-home re-run the capacity check.

- [ ] **Step 1: Replace `frontend/src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { getRoomStatus, joinRoom } from './shared/lib/apiClient';
import type { JoinResponse } from './shared/types';
import { PreJoinScreen } from './features/prejoin';
import { CallFullScreen } from './features/room-states';
import { CallShell, ConnectingScreen } from './features/call';
import { useConnectionStore } from './stores/useConnectionStore';
import { useMediaStore } from './stores/useMediaStore';

const ROOM_NAME = 'main';

type View = 'loading' | 'prejoin' | 'full' | 'connecting' | 'in-call' | 'connect-error';

export function App(): JSX.Element {
  const [view, setView] = useState<View>('loading');
  const [session, setSession] = useState<JoinResponse | null>(null);
  const setPhase = useConnectionStore((s) => s.setPhase);
  const resetConnection = useConnectionStore((s) => s.reset);
  const resetMedia = useMediaStore((s) => s.reset);

  const checkCapacity = useCallback(async () => {
    setView('loading');
    const status = await getRoomStatus(ROOM_NAME);
    setView(status === 'full' ? 'full' : 'prejoin');
  }, []);

  useEffect(() => {
    void checkCapacity();
  }, [checkCapacity]);

  const handleEnter = useCallback(async (name: string) => {
    setView('connecting');
    setPhase('connecting');
    const result = await joinRoom(ROOM_NAME, name);
    if (!result.ok) {
      setView(result.error === 'FULL' ? 'full' : 'prejoin');
      setPhase('idle');
      return;
    }
    setSession(result.data);
    useConnectionStore.getState().setLocalParticipant({
      identity: result.data.identity,
      displayName: result.data.displayName,
    });
    setView('in-call');
  }, [setPhase]);

  const leave = useCallback(() => {
    setSession(null);
    resetConnection();
    resetMedia();
    void checkCapacity();
  }, [checkCapacity, resetConnection, resetMedia]);

  if (view === 'loading' || view === 'connecting') return <ConnectingScreen />;
  if (view === 'full') return <CallFullScreen onBackToHome={() => void checkCapacity()} />;
  if (view === 'in-call' && session) {
    return (
      <CallShell
        accessToken={session.accessToken}
        serverUrl={session.livekitUrl}
        displayName={session.displayName}
        onLeave={leave}
        onConnectError={() => setView('connect-error')}
        onRoomFull={() => setView('full')}
      />
    );
  }
  return <PreJoinScreen onEnter={(name) => void handleEnter(name)} submitting={false} />;
}
```

> `connect-error` falls through to the pre-join branch by design — after a transient connect failure the user lands back on pre-join to retry. (A dedicated error banner is a later refinement; the connect-error string already exists in i18n for Subtask 3.)

- [ ] **Step 2: Write the routing test (`frontend/src/App.test.tsx`)**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import './shared/i18n';

const getRoomStatus = vi.fn();
const joinRoom = vi.fn();
vi.mock('./shared/lib/apiClient', () => ({
  getRoomStatus: (...a: unknown[]) => getRoomStatus(...a),
  joinRoom: (...a: unknown[]) => joinRoom(...a),
}));
vi.mock('./features/call', () => ({
  CallShell: () => <div>in-call-shell</div>,
  ConnectingScreen: () => <div>connecting</div>,
}));

beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
  getRoomStatus.mockReset();
  joinRoom.mockReset();
});

import { App } from './App';

describe('App routing', () => {
  it('renders S1 when the room is full', async () => {
    getRoomStatus.mockResolvedValue('full');
    render(<App />);
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
  });

  it('renders pre-join when the room is available', async () => {
    getRoomStatus.mockResolvedValue('available');
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/your name/i)).toBeInTheDocument());
  });

  it('routes to S1 if join returns FULL', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: false, error: 'FULL' });
    render(<App />);
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
  });

  it('enters the call on a successful join', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({
      ok: true,
      data: { accessToken: 'jwt', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann' },
    });
    render(<App />);
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(screen.getByText('in-call-shell')).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 4: Full frontend gate**

Run: `cd frontend && npm test && npm run typecheck && npm run lint`
Expected: all PASS, zero ESLint warnings (incl. boundary rules).

- [ ] **Step 5: Manual end-to-end smoke (with backend + LiveKit running)**

Run: `livekit-server --dev` (term 1), `cd backend && npm run dev` (term 2), `cd frontend && npm run dev` (term 3). Open `http://localhost:5173`.
Expected: pre-join shows mirrored preview; entering a valid name connects and shows your own tile labelled "Ann (You)"; mic/camera toggles work; Leave returns to pre-join. Open four tabs and join with all four → a fifth tab shows "This call is full."

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): wire capacity flow, pre-join, and in-call routing"
```

---

## Done criteria (whole subtask)

- `cd backend && npm test && npm run typecheck && npm run lint` → all green.
- `cd frontend && npm test && npm run typecheck && npm run lint` → all green.
- Manual smoke (Task 22 Step 5) passes: own media in-call, capacity gate at 4, `S1` screen, name validation, EN strings verbatim per spec §6.
- No hardcoded user-facing strings; Dark theme default; one store per concern; feature boundaries clean.

## Self-Review notes (spec coverage map)

- One fixed room + `maxParticipants` backstop → Task 8 (`ensureRoom`). Soft gate (`listParticipants`) → Tasks 8–9.
- `GET` status / `POST` join (subset shape, no `memberToken`) → Task 9. Duplicate-name acceptance with distinct identity → Tasks 6, 9 (test).
- Pre-join preview + toggles + name help + device-denied messages → Tasks 18–19. Verbatim strings → Task 13.
- `S1` → Task 20. Connecting transient → Tasks 21, 22. In-call own tile (camera-off = mic icon + name, no avatar) + controls + Leave → Task 21.
- Capacity routing + connect-time backstop → `S1` → Tasks 21–22. i18n EN/RU parity, Dark default → Tasks 11, 13. Stores per concern → Task 14.
- Deferred items (remote media/grid, chat, host roles, registry/webhooks, S2–S4, visible theme/lang toggles) are intentionally **not** in any task — they belong to Subtasks 2/3 and the master spec.
