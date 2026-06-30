# M1 — Theme + Language Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working top-right theme toggle (Dark default ⇄ Light) and an EN/RU language selector that switch the whole interface instantly on every screen, persist within the browser session, and reset to Dark/EN in a new session.

**Architecture:** UI preference state lives in the existing `useUiStore` (Zustand), now persisted to `sessionStorage`. A single side-effect hook (`useApplyUiPreferences`) mirrors that state to the DOM (`<html class="dark">`) and to i18next (`changeLanguage`). Presentational `ThemeToggle` and `LanguageSelector` live in a new `features/preferences` slice; a `TopBar` container wires them to the store and is rendered once by `App` so it overlays every screen.

**Tech Stack:** React 19 + TypeScript 6, Zustand 5 (`persist` middleware), react-i18next 17 / i18next 26, Tailwind CSS v4 (`@tailwindcss/vite`, class-based `dark` variant), Vitest 4 + @testing-library/react.

## Global Constraints

- **PRD is the binding source of truth** (`prd-kmb-video-chat.md` v2.0); the Figma file is an outdated visual reference only. This milestone implements **FR-28** (theme) and **FR-29** (language), plus US-15/US-16, NFR-3/NFR-4.
- **Defaults:** theme `dark`, language `en`. (PRD §4 US-15/16, FR-28/29.)
- **Persistence:** the choice persists across page reloads but resets to the default when a **new browser session** begins → use `sessionStorage` (NOT `localStorage`). (FR-28/29, NFR-10.)
- **No `any`**, no `// @ts-ignore`/`// eslint-disable` without justification, no `console.log`. `tsc -b` and `eslint .` must stay clean (zero warnings).
- **Types:** `PascalCase`, no `I`-prefix; finite sets as string-literal unions; `import type` for type-only imports; named exports only.
- **i18n:** no hardcoded user-facing strings in components — every label via `t('key')`; **every key exists in both `en.ts` and `ru.ts`** (the `Translations` type in `ru.ts` enforces this at compile time).
- **Theming:** drive the active theme from `useUiStore`; style with Tailwind `dark:` variants over the light default (the codebase convention, e.g. `body { @apply bg-white ... dark:bg-surface ... }`). Dark is the default theme.
- **Architecture boundaries** (`eslint-plugin-boundaries`): a `feature` may import `shared` and `stores`; `shared` may import only `shared`. Because `ThemeToggle`/`LanguageSelector`/`TopBar` read the store/i18n, they live under `features/preferences`, NOT `shared/ui`.
- **Stores:** one concern per store; actions live in the store; components subscribe to narrow slices.
- **Tests:** co-located `*.test.ts(x)` next to source; Vitest globals are enabled (`globals: true`), jsdom env, setup `@testing-library/jest-dom/vitest`.
- **Scope boundary:** M1 establishes the theme/language *mechanism*, the controls, and the design tokens. Making every pre-existing screen pixel-correct in Light mode is **out of scope** — that is folded into each component's own milestone (M2–M6) and the final fidelity pass. M1's visual exit bar is: the page background, text, and the `TopBar` controls render correctly in both themes.

---

### Task 1: Persist UI preferences + add `toggleTheme`

**Files:**
- Modify: `frontend/src/stores/useUiStore.ts`
- Test: `frontend/src/stores/useUiStore.test.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `useUiStore` with state `{ theme: 'dark'|'light'; language: 'en'|'ru' }` and actions `setTheme(theme): void`, `toggleTheme(): void`, `setLanguage(language): void`. State is persisted to `sessionStorage` under key `kmb-ui` (only `theme` + `language`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/stores/useUiStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './useUiStore';

describe('useUiStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ theme: 'dark', language: 'en' });
  });

  it('defaults to dark theme and english', () => {
    expect(useUiStore.getState().theme).toBe('dark');
    expect(useUiStore.getState().language).toBe('en');
  });

  it('toggleTheme flips between dark and light', () => {
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('light');
    useUiStore.getState().toggleTheme();
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('setLanguage updates the language', () => {
    useUiStore.getState().setLanguage('ru');
    expect(useUiStore.getState().language).toBe('ru');
  });

  it('persists theme and language to sessionStorage', () => {
    useUiStore.getState().setTheme('light');
    useUiStore.getState().setLanguage('ru');
    const raw = sessionStorage.getItem('kmb-ui');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: { theme: string; language: string } };
    expect(parsed.state.theme).toBe('light');
    expect(parsed.state.language).toBe('ru');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/stores/useUiStore.test.ts`
Expected: FAIL — `toggleTheme is not a function` and no `kmb-ui` key in sessionStorage.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/stores/useUiStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Theme = 'dark' | 'light';
type Language = 'en' | 'ru';

type UiState = {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'en',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'kmb-ui',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ theme: s.theme, language: s.language }),
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/stores/useUiStore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useUiStore.ts frontend/src/stores/useUiStore.test.ts
git commit -m "feat(frontend): persist UI prefs to sessionStorage + add toggleTheme"
```

---

### Task 2: `useApplyUiPreferences` side-effect hook

**Files:**
- Create: `frontend/src/features/preferences/hooks/useApplyUiPreferences.ts`
- Test: `frontend/src/features/preferences/hooks/useApplyUiPreferences.test.ts`

**Interfaces:**
- Consumes: `useUiStore` (Task 1); the default i18n instance from `shared/i18n` (`export default i18n`).
- Produces: `useApplyUiPreferences(): void` — on mount and on every change, sets `document.documentElement.classList` to contain `dark` iff theme is dark, and calls `i18n.changeLanguage(language)`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/preferences/hooks/useApplyUiPreferences.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApplyUiPreferences } from './useApplyUiPreferences';
import { useUiStore } from '../../../stores/useUiStore';
import i18n from '../../../shared/i18n';

describe('useApplyUiPreferences', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ theme: 'dark', language: 'en' });
    document.documentElement.classList.remove('dark');
  });

  it('adds the dark class on <html> when theme is dark and removes it for light', () => {
    renderHook(() => useApplyUiPreferences());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    act(() => useUiStore.getState().setTheme('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('switches the i18n language when language changes', async () => {
    renderHook(() => useApplyUiPreferences());
    await act(async () => {
      useUiStore.getState().setLanguage('ru');
    });
    expect(i18n.language).toBe('ru');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/preferences/hooks/useApplyUiPreferences.test.ts`
Expected: FAIL — module `./useApplyUiPreferences` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/features/preferences/hooks/useApplyUiPreferences.ts
import { useEffect } from 'react';
import i18n from '../../../shared/i18n';
import { useUiStore } from '../../../stores/useUiStore';

/**
 * Mirrors the persisted UI preferences to the DOM and i18next:
 * - theme  -> `dark` class on <html> (Tailwind class-based dark variant)
 * - language -> i18next active language
 * Mount once near the app root so the effects run for every screen.
 */
export function useApplyUiPreferences(): void {
  const theme = useUiStore((s) => s.theme);
  const language = useUiStore((s) => s.language);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    void i18n.changeLanguage(language);
  }, [language]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/preferences/hooks/useApplyUiPreferences.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/preferences/hooks/useApplyUiPreferences.ts frontend/src/features/preferences/hooks/useApplyUiPreferences.test.ts
git commit -m "feat(frontend): add useApplyUiPreferences (theme->html, language->i18n)"
```

---

### Task 3: Add i18n strings for the controls (EN + RU)

**Files:**
- Modify: `frontend/src/shared/i18n/en.ts` (the `common` namespace)
- Modify: `frontend/src/shared/i18n/ru.ts` (the `common` namespace)
- Test: `frontend/src/shared/i18n/i18n.test.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: new `common` keys available to `t(...)`: `themeSwitchToLight`, `themeSwitchToDark`, `language`, `languageEnglish`, `languageRussian`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/shared/i18n/i18n.test.ts
import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';

describe('i18n resources', () => {
  it('en and ru expose identical keys in every namespace', () => {
    const namespaces = Object.keys(en) as (keyof typeof en)[];
    for (const ns of namespaces) {
      expect(Object.keys(ru[ns]).sort()).toEqual(Object.keys(en[ns]).sort());
    }
  });

  it('common carries the theme and language control strings', () => {
    expect(en.common.themeSwitchToLight).toBeTruthy();
    expect(en.common.themeSwitchToDark).toBeTruthy();
    expect(en.common.language).toBeTruthy();
    expect(en.common.languageEnglish).toBeTruthy();
    expect(en.common.languageRussian).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/shared/i18n/i18n.test.ts`
Expected: FAIL — `en.common.themeSwitchToLight` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/shared/i18n/en.ts`, replace the `common` block with:

```ts
  common: {
    appName: 'kmb-video-chat',
    connecting: 'Connecting…',
    connectError: 'Unable to connect to the call service. Please check your internet connection and try again.',
    retry: 'Try again',
    themeSwitchToLight: 'Switch to light theme',
    themeSwitchToDark: 'Switch to dark theme',
    language: 'Language',
    languageEnglish: 'English',
    languageRussian: 'Russian',
  },
```

In `frontend/src/shared/i18n/ru.ts`, replace the `common` block with:

```ts
  common: {
    appName: 'kmb-video-chat',
    connecting: 'Подключение…',
    connectError: 'Не удалось подключиться к сервису звонков. Проверьте подключение к интернету и попробуйте снова.',
    retry: 'Попробовать снова',
    themeSwitchToLight: 'Переключить на светлую тему',
    themeSwitchToDark: 'Переключить на тёмную тему',
    language: 'Язык',
    languageEnglish: 'Английский',
    languageRussian: 'Русский',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/shared/i18n/i18n.test.ts && cd frontend && npx tsc -b`
Expected: PASS (2 tests); `tsc` clean (the `Translations` type in `ru.ts` confirms parity).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/i18n/en.ts frontend/src/shared/i18n/ru.ts frontend/src/shared/i18n/i18n.test.ts
git commit -m "feat(frontend): add EN/RU strings for theme + language controls"
```

---

### Task 4: `ThemeToggle` presentational component

**Files:**
- Create: `frontend/src/features/preferences/components/ThemeToggle.tsx`
- Test: `frontend/src/features/preferences/components/ThemeToggle.test.tsx`

**Interfaces:**
- Consumes: nothing (pure presentational).
- Produces: `ThemeToggle(props: ThemeToggleProps): JSX.Element` where
  `ThemeToggleProps = { theme: 'dark' | 'light'; label: string; onToggle: () => void }`.
  Renders an icon-only `<button>` with `aria-label={label}`; shows a sun glyph in dark mode and a moon glyph in light mode.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/preferences/components/ThemeToggle.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('exposes the given accessible label and fires onToggle on click', () => {
    const onToggle = vi.fn();
    render(<ThemeToggle theme="dark" label="Switch to light theme" onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Switch to light theme' });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/preferences/components/ThemeToggle.test.tsx`
Expected: FAIL — module `./ThemeToggle` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/features/preferences/components/ThemeToggle.tsx
import type { JSX } from 'react';

export type ThemeToggleProps = {
  theme: 'dark' | 'light';
  label: string;
  onToggle: () => void;
};

export function ThemeToggle({ theme, label, onToggle }: ThemeToggleProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onToggle}
      className="grid h-9 w-9 place-items-center rounded-full text-slate-700 transition hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/preferences/components/ThemeToggle.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/preferences/components/ThemeToggle.tsx frontend/src/features/preferences/components/ThemeToggle.test.tsx
git commit -m "feat(frontend): add ThemeToggle presentational component"
```

---

### Task 5: `LanguageSelector` presentational component

**Files:**
- Create: `frontend/src/features/preferences/components/LanguageSelector.tsx`
- Test: `frontend/src/features/preferences/components/LanguageSelector.test.tsx`

**Interfaces:**
- Consumes: nothing (pure presentational).
- Produces: `LanguageSelector(props: LanguageSelectorProps): JSX.Element` where
  `LanguageSelectorProps = { language: 'en' | 'ru'; groupLabel: string; englishLabel: string; russianLabel: string; onChange: (language: 'en' | 'ru') => void }`.
  Renders a `role="group"` with two buttons (`EN`, `RU`); the active one has `aria-pressed={true}`; each button's accessible name is the corresponding `*Label`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/preferences/components/LanguageSelector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';

const baseProps = {
  groupLabel: 'Language',
  englishLabel: 'English',
  russianLabel: 'Russian',
};

describe('LanguageSelector', () => {
  it('marks the active language as pressed', () => {
    render(<LanguageSelector language="en" onChange={vi.fn()} {...baseProps} />);
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Russian' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the chosen language', () => {
    const onChange = vi.fn();
    render(<LanguageSelector language="en" onChange={onChange} {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Russian' }));
    expect(onChange).toHaveBeenCalledWith('ru');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/preferences/components/LanguageSelector.test.tsx`
Expected: FAIL — module `./LanguageSelector` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/features/preferences/components/LanguageSelector.tsx
import type { JSX } from 'react';

type Language = 'en' | 'ru';

export type LanguageSelectorProps = {
  language: Language;
  groupLabel: string;
  englishLabel: string;
  russianLabel: string;
  onChange: (language: Language) => void;
};

export function LanguageSelector({
  language,
  groupLabel,
  englishLabel,
  russianLabel,
  onChange,
}: LanguageSelectorProps): JSX.Element {
  return (
    <div role="group" aria-label={groupLabel} className="flex items-center gap-0.5 rounded-full bg-black/5 p-0.5 dark:bg-white/10">
      <LanguageButton code="en" text="EN" label={englishLabel} active={language === 'en'} onClick={onChange} />
      <LanguageButton code="ru" text="RU" label={russianLabel} active={language === 'ru'} onClick={onChange} />
    </div>
  );
}

type LanguageButtonProps = {
  code: Language;
  text: string;
  label: string;
  active: boolean;
  onClick: (language: Language) => void;
};

function LanguageButton({ code, text, label, active, onClick }: LanguageButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/preferences/components/LanguageSelector.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/preferences/components/LanguageSelector.tsx frontend/src/features/preferences/components/LanguageSelector.test.tsx
git commit -m "feat(frontend): add LanguageSelector presentational component"
```

---

### Task 6: `TopBar` container + feature public entry

**Files:**
- Create: `frontend/src/features/preferences/components/TopBar.tsx`
- Create: `frontend/src/features/preferences/index.ts`
- Test: `frontend/src/features/preferences/components/TopBar.test.tsx`

**Interfaces:**
- Consumes: `useUiStore` (Task 1), `ThemeToggle` (Task 4), `LanguageSelector` (Task 5), `common` i18n strings (Task 3).
- Produces: `TopBar(): JSX.Element` — a `position: fixed` top-right cluster (language selector + theme toggle) wired to the store. The feature's public entry `features/preferences/index.ts` re-exports `TopBar` and `useApplyUiPreferences` (Task 2).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/preferences/components/TopBar.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../../shared/i18n';
import { TopBar } from './TopBar';
import { useUiStore } from '../../../stores/useUiStore';

describe('TopBar', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ theme: 'dark', language: 'en' });
  });

  it('renders theme and language controls', () => {
    render(<TopBar />);
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /english/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /russian/i })).toBeInTheDocument();
  });

  it('toggles the store theme when the theme button is clicked', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(useUiStore.getState().theme).toBe('light');
  });

  it('sets the store language when a language button is clicked', () => {
    render(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: /russian/i }));
    expect(useUiStore.getState().language).toBe('ru');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/preferences/components/TopBar.test.tsx`
Expected: FAIL — module `./TopBar` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/features/preferences/components/TopBar.tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../../stores/useUiStore';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from './LanguageSelector';

export function TopBar(): JSX.Element {
  const { t } = useTranslation('common');
  const theme = useUiStore((s) => s.theme);
  const language = useUiStore((s) => s.language);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setLanguage = useUiStore((s) => s.setLanguage);

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
      <LanguageSelector
        language={language}
        onChange={setLanguage}
        groupLabel={t('language')}
        englishLabel={t('languageEnglish')}
        russianLabel={t('languageRussian')}
      />
      <ThemeToggle
        theme={theme}
        onToggle={toggleTheme}
        label={theme === 'dark' ? t('themeSwitchToLight') : t('themeSwitchToDark')}
      />
    </div>
  );
}
```

```ts
// frontend/src/features/preferences/index.ts
export { TopBar } from './components/TopBar';
export { useApplyUiPreferences } from './hooks/useApplyUiPreferences';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/preferences/components/TopBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/preferences/components/TopBar.tsx frontend/src/features/preferences/index.ts frontend/src/features/preferences/components/TopBar.test.tsx
git commit -m "feat(frontend): add TopBar container wiring theme + language to the store"
```

---

### Task 7: Mount `TopBar` + apply hook in `App` (every screen)

**Files:**
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/App.test.tsx` (add cases)

**Interfaces:**
- Consumes: `TopBar`, `useApplyUiPreferences` from `features/preferences` (Task 6).
- Produces: every view rendered by `App` now also shows the `TopBar`; preferences are applied app-wide via `useApplyUiPreferences()`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/App.test.tsx`, inside `describe('App routing', ...)`:

```tsx
  it('shows the theme and language controls on the full-room screen', async () => {
    getRoomStatus.mockResolvedValue('full');
    render(<App />);
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /russian/i })).toBeInTheDocument();
  });

  it('shows the theme and language controls on the pre-join screen', async () => {
    getRoomStatus.mockResolvedValue('available');
    render(<App />);
    await waitFor(() => screen.getByLabelText(/your name/i));
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: FAIL — no element with name `/switch to light theme/i` (TopBar not mounted).

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/App.tsx`: add the import, call the hook, and wrap the rendered view with `TopBar`.

Add to the imports block:

```tsx
import { TopBar, useApplyUiPreferences } from './features/preferences';
```

Immediately after `export function App(): JSX.Element {` and the existing store-selector lines, add:

```tsx
  useApplyUiPreferences();
```

Replace the final render section (everything from `if (view === 'loading' || view === 'connecting') return ...` to the end of the function) with:

```tsx
  let content: JSX.Element;
  if (view === 'loading' || view === 'connecting') {
    content = <ConnectingScreen />;
  } else if (view === 'full') {
    content = <CallFullScreen onBackToHome={recheckCapacity} />;
  } else if (view === 'connect-error') {
    content = <ConnectErrorScreen onRetry={recheckCapacity} />;
  } else if (view === 'in-call' && session) {
    content = (
      <>
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          displayName={session.displayName}
          onLeave={leave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
        />
        <ChatPanel role={session.role} />
      </>
    );
  } else {
    content = <PreJoinScreen onEnter={(name) => void handleEnter(name)} />;
  }

  return (
    <>
      <TopBar />
      {content}
    </>
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: PASS (all prior cases + the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): render TopBar + apply UI preferences on every screen"
```

---

### Task 8: Align dark tokens to Figma + establish the Light palette

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: nothing (CSS/token layer).
- Produces: Tailwind theme tokens aligned to the Figma dark palette, plus the documented Light defaults. No TypeScript surface changes.

**Palette decisions (Figma dark = `RhDsYTrw77YBs88mLteyUP` color variables; Light derived from them):**

| Token | Dark (Figma) | Light (derived) | Use |
|-------|--------------|------------------|-----|
| app background | `#181B1D` (Primary/Black) | `#FFFFFF` | page / `body` |
| elevated surface | `#1F2224` (Primary/Gray dark) | `#F4F5F7` | cards, chat panel, modals |
| muted surface / border | `#2A2E30` (Primary/Gray) | `#E2E5EA` | inputs, dividers, control pills |
| accent | `#2C68FA` (Primary/Blue) | `#2C68FA` (same) | primary buttons, active state |
| accent strong (hover) | `#285DDF` (Primary/Blue more) | `#285DDF` (same) | button hover |
| danger | `#FF4E4E` (Secondary/Red) | `#FF4E4E` (same) | End call |
| sender name | `#9180FF` (Secondary/Purple) | `#7A68F0` | chat sender labels |
| primary text | `#FFFFFF` → `slate-100` | `#181B1D` → `slate-900` | body text |

> Convention (unchanged): **light is the default utility, `dark:` overrides to the dark token** — e.g. `bg-white dark:bg-surface`. Video tiles keep a dark backing in both themes (PRD §12). Re-theming the existing M2–M6 components to honour this table is their own milestones' work; this task only sets the tokens + keeps `body` correct in both themes.

- [ ] **Step 1: Update `frontend/src/index.css`**

```css
@import "tailwindcss";

/* Class-based dark mode (driven by useUiStore toggling `.dark` on <html>) */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Accent / status — identical in both themes (Figma dark palette) */
  --color-accent: #2c68fa;        /* Primary/Blue */
  --color-accent-strong: #285ddf; /* Primary/Blue more (hover) */
  --color-danger: #ff4e4e;        /* Secondary/Red — End call */
  --color-sender: #9180ff;        /* Secondary/Purple — chat sender name */

  /* Dark surfaces (Figma "Young Fighter" dark palette) */
  --color-surface: #181b1d;          /* Primary/Black — app background */
  --color-surface-elevated: #1f2224; /* Primary/Gray dark — cards, panels, modals */
  --color-surface-muted: #2a2e30;    /* Primary/Gray — inputs, borders, control pills */
}

html, body, #root { height: 100%; }
body { @apply bg-white text-slate-900 dark:bg-surface dark:text-slate-100; }
```

- [ ] **Step 2: Verify the build and full test suite are clean**

Run: `cd frontend && npx tsc -b && npx eslint . && npx vitest run`
Expected: typecheck clean, lint clean (0 warnings), all tests PASS.

- [ ] **Step 3: Manual verification in the running app**

Run (from repo root): `npm run dev` (Docker must be up for LiveKit; if not, `frontend` alone: `cd frontend && npm run dev`).
Open `http://localhost:5173` and confirm:
- Theme/language controls appear in the **top-right** on the pre-join screen.
- Default theme is **Dark**; clicking the sun/moon toggle switches the page background and text **instantly**; clicking again returns to Dark.
- Clicking **RU** switches all visible interface text to Russian instantly; **EN** switches back.
- **Reload the page** → the last chosen theme and language are retained (sessionStorage).
- **Close the browser and reopen** (or open a new browser session) → theme resets to **Dark**, language to **EN**.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(frontend): align dark tokens to Figma palette + add light theme baseline"
```

---

## Self-Review

**Spec coverage:**
- FR-28 (theme toggle top-right, Dark default, app-wide instant switch, session-persist, reset to Dark new session): Tasks 1 (persist+toggle), 2 (apply `.dark`), 4 (toggle UI), 6 (top-right placement), 7 (every screen), 8 (tokens). ✓
- FR-29 (language selector top-right, EN default, app-wide instant switch, session-persist, reset to EN new session; sent messages keep original text — message content is untouched by `changeLanguage`): Tasks 1, 2 (`changeLanguage`), 3 (strings), 5 (selector UI), 6, 7. ✓
- US-15/US-16: same tasks; manual verification in Task 8 Step 3 covers the reload + new-session behavior. ✓
- NFR-3 (accessible labels on icon-only buttons): `aria-label` on `ThemeToggle` (Task 4) and per-button `aria-label` + group label on `LanguageSelector` (Task 5). ✓
- NFR-4 (externalized strings, EN+RU): Task 3 + parity test. ✓

**Placeholder scan:** No TBD/“handle errors”/“similar to”/empty test bodies — every step ships concrete code and an exact command. ✓

**Type consistency:** `theme: 'dark'|'light'`, `language: 'en'|'ru'` used identically across `useUiStore`, `useApplyUiPreferences`, `ThemeToggle`, `LanguageSelector`, `TopBar`. Action names `setTheme`/`toggleTheme`/`setLanguage` match between Task 1's `Produces` and every consumer. `LanguageSelectorProps` field names (`groupLabel`/`englishLabel`/`russianLabel`/`onChange`) match Task 5 impl and Task 6 usage. i18n keys (`themeSwitchToLight`/`themeSwitchToDark`/`language`/`languageEnglish`/`languageRussian`) match between Task 3 and Task 6. ✓

> **Note for the implementer:** if `zustand/middleware`'s `persist` is not already a dependency surface in use, it ships with `zustand@5` (already installed) — no new dependency. If `renderHook`/`act` import from `@testing-library/react` errors in this RTL version, fall back to `import { act } from 'react'` and keep `renderHook` from `@testing-library/react`.
