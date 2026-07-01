# Frontend Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the four maintainer review comments on the current MR (LanguageSelector aria-label, name-validation hook→helper, chat store open/read coupling, un-pinned dependency carets).

**Architecture:** Four independent edits to existing, tested frontend modules. Each follows an adjust-test-first (red) → change-implementation (green) cycle, since every target already has co-located tests. No new runtime behavior beyond what the reviewers requested.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, Zustand, zod, react-i18next, npm.

## Global Constraints

- All work happens in `C:\claudeProj` on branch `feat/m3-host-guest-rooms` (M3 console has finished; tree is clean apart from the M3 plan doc — **do not touch `docs/superpowers/plans/2026-06-30-m3-host-guest-rooms.md`**).
- Verification per task runs **from `frontend/`**: `npm run typecheck`, `npm run lint`, `npm run test`. All three must be clean before commit.
- Types/interfaces `PascalCase`, no `I`-prefix; string-literal unions over `enum`.
- No `any`, no `// @ts-ignore`, no `console.log`.
- No hardcoded user-facing strings — everything through `t('key')`; EN and RU keys stay in parity (enforced by `i18n.test.ts`).
- Tests co-located as `*.test.ts(x)` next to source.
- Commit convention: `fix(frontend): …`, one commit per task.

---

## File Structure

| File | Task | Responsibility after change |
| --- | --- | --- |
| `frontend/src/features/preferences/components/LanguageSelector.tsx` | 1 | Compact EN/RU toggle; visible code is the accessible name (no per-button `aria-label`) |
| `frontend/src/features/preferences/components/TopBar.tsx` | 1 | Stops passing `englishLabel`/`russianLabel` |
| `frontend/src/features/preferences/components/LanguageSelector.test.tsx` | 1 | Asserts against `EN`/`RU` accessible names |
| `frontend/src/shared/i18n/en.ts`, `ru.ts` | 1 | Drop now-unused `languageEnglish`/`languageRussian` |
| `frontend/src/shared/i18n/i18n.test.ts` | 1 | Drop the two dead-key assertions |
| `frontend/src/features/prejoin/nameValidation.ts` | 2 | **New** pure `validateName()` helper + `NameErrorKey`/`NameValidity` types |
| `frontend/src/features/prejoin/nameValidation.test.ts` | 2 | **New** direct-call tests |
| `frontend/src/features/prejoin/hooks/useNameValidation.ts` + `.test.ts` | 2 | **Deleted** |
| `frontend/src/features/prejoin/PreJoinScreen.tsx` | 2 | Calls `validateName(name)` |
| `frontend/src/features/prejoin/components/NameInput.tsx` | 2 | Imports `NameErrorKey` type from new path |
| `frontend/src/stores/useChatStore.ts` | 3 | `openPanel`/`togglePanel` only manage visibility; new `markAllRead` |
| `frontend/src/features/call/components/ControlsBar.tsx` | 3 | Chat button clears unread on open, explicitly |
| `frontend/src/stores/useChatStore.test.ts` | 3 | Reflect decoupled open/read |
| `frontend/.npmrc` | 4 | **New** `save-exact=true` |
| `frontend/package.json` + `package-lock.json` | 4 | Pin `clsx`, `react-router-dom` |
| `.claude/rules/00-project-base.md` | 4 | Document exact-version policy |

---

## Task 1: LanguageSelector — drop `aria-label`, let the visible code be the accessible name

**Why:** A `<button>` with visible text `"EN"` and `aria-label="English"` is a WCAG 2.5.3 *Label-in-Name* mismatch (announced name ≠ visible name) and redundant. Let the visible `"EN"`/`"RU"` be the accessible name; keep `aria-pressed` and the group's `aria-label`. This removes the `englishLabel`/`russianLabel` props and their now-dead i18n keys.

**Files:**
- Modify: `frontend/src/features/preferences/components/LanguageSelector.tsx`
- Modify: `frontend/src/features/preferences/components/TopBar.tsx`
- Modify: `frontend/src/features/preferences/components/LanguageSelector.test.tsx`
- Modify: `frontend/src/shared/i18n/en.ts`, `frontend/src/shared/i18n/ru.ts`, `frontend/src/shared/i18n/i18n.test.ts`

**Interfaces:**
- Produces: `LanguageSelectorProps = { language: 'en' | 'ru'; groupLabel: string; onChange: (language) => void }` — `englishLabel`/`russianLabel` removed.

- [ ] **Step 1: Update the tests to the new contract (red).** Replace the file with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

const baseProps = { groupLabel: 'Language' };

describe('LanguageSelector', () => {
  it('marks the active language as pressed', () => {
    render(<LanguageSelector language="en" onChange={vi.fn()} {...baseProps} />);
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the chosen language', () => {
    const onChange = vi.fn();
    render(<LanguageSelector language="en" onChange={onChange} {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'RU' }));
    expect(onChange).toHaveBeenCalledWith('ru');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

Run: `npm run test -- LanguageSelector`
Expected: FAIL — current component still requires `englishLabel`/`russianLabel` and exposes `English`/`Russian` names.

- [ ] **Step 3: Rewrite the component.** Replace `LanguageSelector.tsx` with:

```tsx
import type { JSX } from 'react';

type Language = 'en' | 'ru';

export type LanguageSelectorProps = {
  language: Language;
  groupLabel: string;
  onChange: (language: Language) => void;
};

export function LanguageSelector({ language, groupLabel, onChange }: LanguageSelectorProps): JSX.Element {
  return (
    <div role="group" aria-label={groupLabel} className="flex items-center gap-0.5 rounded-full bg-black/5 p-0.5 dark:bg-white/10">
      <LanguageButton code="en" text="EN" active={language === 'en'} onClick={onChange} />
      <LanguageButton code="ru" text="RU" active={language === 'ru'} onClick={onChange} />
    </div>
  );
}

type LanguageButtonProps = {
  code: Language;
  text: string;
  active: boolean;
  onClick: (language: Language) => void;
};

function LanguageButton({ code, text, active, onClick }: LanguageButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onClick(code)}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active ? 'bg-accent text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
      }`}
    >
      {text}
    </button>
  );
}
```

- [ ] **Step 4: Update `TopBar.tsx` caller.** Change the `<LanguageSelector>` element (drop the two label props):

```tsx
      <LanguageSelector
        language={language}
        onChange={setLanguage}
        groupLabel={t('language')}
      />
```

- [ ] **Step 5: Remove the dead i18n keys.** In `en.ts`, delete lines `languageEnglish: 'English',` and `languageRussian: 'Russian',`. In `ru.ts`, delete `languageEnglish: 'Английский',` and `languageRussian: 'Русский',`. (Keep `language:`.) In `i18n.test.ts`, delete the two assertions:

```ts
    expect(en.common.languageEnglish).toBeTruthy();
    expect(en.common.languageRussian).toBeTruthy();
```

- [ ] **Step 6: Verify.**

Run: `npm run test -- LanguageSelector i18n` then `npm run typecheck` then `npm run lint`
Expected: all PASS / clean. (`typecheck` confirms no lingering references to the removed props/keys.)

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/features/preferences/components/LanguageSelector.tsx \
        frontend/src/features/preferences/components/LanguageSelector.test.tsx \
        frontend/src/features/preferences/components/TopBar.tsx \
        frontend/src/shared/i18n/en.ts frontend/src/shared/i18n/ru.ts frontend/src/shared/i18n/i18n.test.ts
git commit -m "fix(frontend): use visible language code as accessible name, drop redundant aria-label"
```

---

## Task 2: `useNameValidation` → pure `validateName` helper

**Why:** The validation is pure, stateless, side-effect-free — no reason to be a hook, and `useMemo` over a cheap parse buys nothing. Convert to a helper. (Reviewer accepted the self-rolled zod validation; do **not** add react-hook-form.)

**Files:**
- Create: `frontend/src/features/prejoin/nameValidation.ts`
- Create: `frontend/src/features/prejoin/nameValidation.test.ts`
- Delete: `frontend/src/features/prejoin/hooks/useNameValidation.ts`, `frontend/src/features/prejoin/hooks/useNameValidation.test.ts`
- Modify: `frontend/src/features/prejoin/PreJoinScreen.tsx`, `frontend/src/features/prejoin/components/NameInput.tsx`

**Interfaces:**
- Produces: `validateName(name: string): NameValidity`; `NameErrorKey = 'nameEmpty' | 'nameLength' | 'nameChars'`; `NameValidity = { valid: boolean; errorKey: NameErrorKey | null }`.

- [ ] **Step 1: Write the new test (red — file doesn't exist yet).** Create `nameValidation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateName } from './nameValidation';

describe('validateName', () => {
  it('flags empty input', () => {
    expect(validateName('   ')).toEqual({ valid: false, errorKey: 'nameEmpty' });
  });

  it('flags too-short input as length', () => {
    expect(validateName('A').errorKey).toBe('nameLength');
  });

  it('flags illegal characters', () => {
    expect(validateName('Ann@home').errorKey).toBe('nameChars');
  });

  it('accepts a valid name', () => {
    expect(validateName("O'Neil-7")).toEqual({ valid: true, errorKey: null });
  });
});
```

- [ ] **Step 2: Run to confirm it fails.**

Run: `npm run test -- nameValidation`
Expected: FAIL — cannot resolve `./nameValidation`.

- [ ] **Step 3: Create the helper.** Create `nameValidation.ts` (logic ported verbatim from the old hook, minus React/`useMemo`):

```ts
import { z } from 'zod';

// Bare keys within the 'prejoin' i18n namespace — consumers resolve them with the namespaced t().
export type NameErrorKey = 'nameEmpty' | 'nameLength' | 'nameChars';
export type NameValidity = { valid: boolean; errorKey: NameErrorKey | null };

// Display-name rule. Source of truth: PRD §6. Intentionally duplicated from the backend
// (backend/src/validation.ts) for instant client-side feedback; the server re-validates as the
// authority. Keep both copies in sync with the PRD.
const NAME_PATTERN = /^[\p{L}\p{N} '-]{2,30}$/u;

// Each refine carries its reason code as the issue message; the first failing check wins, giving
// the priority empty → length → chars.
const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .refine((s) => s.length > 0, { error: 'nameEmpty' })
      .refine((s) => s.length >= 2 && s.length <= 30, { error: 'nameLength' })
      .refine((s) => NAME_PATTERN.test(s), { error: 'nameChars' }),
  );

const NAME_ERROR_KEYS = new Set<string>(['nameEmpty', 'nameLength', 'nameChars']);

function isNameErrorKey(x: unknown): x is NameErrorKey {
  return typeof x === 'string' && NAME_ERROR_KEYS.has(x);
}

export function validateName(name: string): NameValidity {
  const result = nameSchema.safeParse(name);
  if (result.success) return { valid: true, errorKey: null };
  const [issue] = result.error.issues;
  const errorKey: NameErrorKey = isNameErrorKey(issue?.message) ? issue.message : 'nameEmpty';
  return { valid: false, errorKey };
}
```

- [ ] **Step 4: Delete the old hook + its test.**

```bash
git rm frontend/src/features/prejoin/hooks/useNameValidation.ts \
       frontend/src/features/prejoin/hooks/useNameValidation.test.ts
```

- [ ] **Step 5: Update the two consumers.**

In `PreJoinScreen.tsx`: replace the import `import { useNameValidation } from './hooks/useNameValidation';` with `import { validateName } from './nameValidation';`, and replace the call `const { valid, errorKey } = useNameValidation(name);` with:

```tsx
  const { valid, errorKey } = validateName(name);
```

In `NameInput.tsx`: change the type import to the new path:

```tsx
import type { NameErrorKey } from '../nameValidation';
```

- [ ] **Step 6: Verify.**

Run: `npm run test -- nameValidation PreJoinScreen NameInput` then `npm run typecheck` then `npm run lint`
Expected: all PASS / clean. (`typecheck` confirms no dangling `useNameValidation` import survived.)

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/features/prejoin/nameValidation.ts \
        frontend/src/features/prejoin/nameValidation.test.ts \
        frontend/src/features/prejoin/PreJoinScreen.tsx \
        frontend/src/features/prejoin/components/NameInput.tsx
git commit -m "fix(frontend): make name validation a pure helper instead of a hook"
```

---

## Task 3: `useChatStore` — separate opening the panel from marking messages read

**Why:** `openPanel`/`togglePanel` silently zeroing `unreadCount` conflates two concerns. Make those actions manage visibility only; add an explicit `markAllRead`; the chat control composes them (clear on open) so the behavior is visible at the call site.

**Files:**
- Modify: `frontend/src/stores/useChatStore.ts`
- Modify: `frontend/src/features/call/components/ControlsBar.tsx`
- Modify: `frontend/src/stores/useChatStore.test.ts`

**Interfaces:**
- Produces (store actions): `openPanel(): void` (sets `isPanelOpen: true` only), `togglePanel(): void` (flips `isPanelOpen` only), `markAllRead(): void` (sets `unreadCount: 0`). `receiveMessage` still guards `unreadCount` on `isPanelOpen` (unchanged).

- [ ] **Step 1: Update the store tests to the decoupled contract (red).**

Replace the `openPanel` test (currently "openPanel resets unread; messages received while open do not bump") with:

```ts
  it('openPanel opens without clearing unread; markAllRead clears it', () => {
    useChatStore.getState().receiveMessage(serverMsg({}), SELF.identity);
    useChatStore.getState().openPanel();
    expect(useChatStore.getState().isPanelOpen).toBe(true);
    expect(useChatStore.getState().unreadCount).toBe(1); // opening no longer marks read
    useChatStore.getState().markAllRead();
    expect(useChatStore.getState().unreadCount).toBe(0);
    useChatStore.getState().receiveMessage(serverMsg({ id: 'srv2' }), SELF.identity);
    expect(useChatStore.getState().unreadCount).toBe(0); // received while open does not bump
  });
```

Replace the two `togglePanel` tests that assert clearing:

```ts
    it('toggles from closed to open without clearing unreadCount', () => {
      useChatStore.setState({ isPanelOpen: false, unreadCount: 3 });
      useChatStore.getState().togglePanel();
      const s = useChatStore.getState();
      expect(s.isPanelOpen).toBe(true);
      expect(s.unreadCount).toBe(3); // togglePanel manages visibility only
    });
```

```ts
    it('idempotent double-toggle returns to the start visibility, unread untouched', () => {
      useChatStore.setState({ isPanelOpen: false, unreadCount: 2 });
      useChatStore.getState().togglePanel(); // → open
      useChatStore.getState().togglePanel(); // → closed
      const s = useChatStore.getState();
      expect(s.isPanelOpen).toBe(false);
      expect(s.unreadCount).toBe(2);
    });
```

(The "toggles from open to closed and leaves unreadCount untouched" test already asserts `5` stays `5` — leave it as-is.)

- [ ] **Step 2: Run to confirm failure.**

Run: `npm run test -- useChatStore`
Expected: FAIL — `markAllRead` is not a function; old actions still clear unread.

- [ ] **Step 3: Update the store.** In `useChatStore.ts`:

Add to the `ChatState` type, next to the other panel actions:

```ts
  markAllRead: () => void;
```

Replace the `openPanel`/`togglePanel` implementations with:

```ts
  openPanel: () => set({ isPanelOpen: true }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  markAllRead: () => set({ unreadCount: 0 }),
```

- [ ] **Step 4: Compose them in the chat control.** In `ControlsBar.tsx`, add two selectors next to the existing chat ones:

```tsx
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const markAllRead = useChatStore((s) => s.markAllRead);
```

Add a handler (above the `return`) and use it on the chat button:

```tsx
  const handleToggleChat = (): void => {
    if (!isPanelOpen) markAllRead(); // opening the panel marks everything read
    togglePanel();
  };
```

Change the chat button's `onClick={togglePanel}` to `onClick={handleToggleChat}`.

- [ ] **Step 5: Verify.**

Run: `npm run test -- useChatStore ControlsBar` then `npm run typecheck` then `npm run lint`
Expected: all PASS. `ControlsBar.chat.test.tsx` (click Chat → `unreadCount` 0) still passes because the handler clears on open.

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/stores/useChatStore.ts frontend/src/stores/useChatStore.test.ts \
        frontend/src/features/call/components/ControlsBar.tsx
git commit -m "fix(frontend): separate opening the chat panel from marking messages read"
```

---

## Task 4: Pin exact dependency versions

**Why:** Every dependency is pinned except `clsx: "^2.1.1"` and the just-added `react-router-dom: "^7.18.1"`. Enforce exact versions via `.npmrc`, pin the two strays, and document the policy in the Claude rules (reviewer: "в рулсы клоду или .npmrc" — do both).

**Files:**
- Create: `frontend/.npmrc`
- Modify: `frontend/package.json`, `frontend/package-lock.json` (regenerated)
- Modify: `.claude/rules/00-project-base.md`

- [ ] **Step 1: Create `frontend/.npmrc`.**

```
save-exact=true
```

- [ ] **Step 2: Pin the two dependencies in `frontend/package.json`.** Change:

```json
    "clsx": "^2.1.1",
```
to
```json
    "clsx": "2.1.1",
```
and
```json
    "react-router-dom": "^7.18.1",
```
to
```json
    "react-router-dom": "7.18.1",
```

- [ ] **Step 3: Sync the lockfile.** From `frontend/`:

Run: `npm install --package-lock-only`
Expected: exits clean; `package-lock.json` updates so the `clsx` / `react-router-dom` spec entries no longer carry `^` (resolved versions are unchanged — both already satisfied the caret).

- [ ] **Step 4: Confirm no carets remain in dependency specs.**

Run (from `frontend/`): `npm run typecheck && npm run test`
Expected: clean — pinning is a metadata change; nothing at runtime shifts. (A quick manual grep of `package.json` `dependencies`/`devDependencies` should show zero `^`/`~`.)

- [ ] **Step 5: Document the policy.** In `.claude/rules/00-project-base.md`, add a bullet at the end of the **## Core principles** list:

```markdown
- **Pin exact dependency versions.** No `^`/`~` ranges in `package.json`; `frontend/.npmrc`
  sets `save-exact=true` so new installs pin automatically. Upgrade deliberately, not implicitly.
```

- [ ] **Step 6: Commit.**

```bash
git add frontend/.npmrc frontend/package.json frontend/package-lock.json .claude/rules/00-project-base.md
git commit -m "fix(frontend): pin exact dependency versions (.npmrc save-exact + rule)"
```

---

## Self-Review

- **Coverage:** Comment 1 → Task 1; comment 2 → Task 2; comment 3 → Task 3; comment 4 → Task 4. All four addressed.
- **Placeholders:** none — every code/step is concrete.
- **Type consistency:** `validateName`/`NameErrorKey`/`NameValidity` names match across Task 2's helper, `NameInput` import, and `PreJoinScreen` usage. `markAllRead` name matches across store type, store impl, `ControlsBar`, and store test.
- **Blast-radius checks:** Task 1 removes i18n keys → `i18n.test.ts` parity + assertions updated in the same task (RU's `Translations` type derives from EN, so `tsc` enforces both sides). Task 2's deletion has only two importers, both updated. Task 3 keeps `ControlsBar.chat.test.tsx` green via the on-open handler.
- **Non-interference:** the M3 plan doc (`2026-06-30-m3-host-guest-rooms.md`) is left untouched.
