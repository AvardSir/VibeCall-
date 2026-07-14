# M7a — Figma Pixel-Perfect: Foundation (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the design-system primitives every screen composes — the app font, type scale, color tokens, `Button`, `Tooltip`, the pre-join card + name input, and the Figma icon SVG assets — so every **Figma-covered static surface** matches Figma exactly.

**Architecture:** Frontend-only. Fix the shared primitives (`shared/ui/*`, `index.css`) first, then the one Figma-covered composed screen (pre-join), then bundle the icon assets M7b will consume. No backend, no new PRD behavior — pure visual fidelity on the screens Figma covers.

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4 (`@theme` tokens + `dark:` variant), Vitest 4 + @testing-library/react, `@fontsource-variable/roboto-flex`, react-i18next.

> ⚠ **Plan freshness — read before executing.** This plan was written **ahead of time**, while M5/M6 were still in development, but M7a **executes last (after M5 + M6 land)**. The snapshots below — exact file contents, `path:line` references, current class strings, and even whether a file/symbol still exists in the shown form — reflect the codebase *at authoring time* and **may have drifted** by execution. Treat the code blocks as the *intended end state*, not a guaranteed diff base. **At execution, for every task: (1) re-read the actual current file before editing** (the `old_string` you replace may differ from what's shown), **(2) re-confirm the Figma values against the audit** (`docs/superpowers/design/2026-07-01-figma-conformance-audit.md`) in case it was revised, **(3) adapt paths/imports to the real tree**, and (4) if a task's premise no longer holds (e.g. a file was already restyled by M5/M6), flag it and adjust rather than force the shown edit. The TDD gates (failing test → implement → passing test) are the backstop — trust them over the literal snapshots.

## Global Constraints

- **Source of truth:** the Figma Conformance Audit `docs/superpowers/design/2026-07-01-figma-conformance-audit.md` — §2 (tokens), §3 (components), §4 (pre-join), §5 (backlog items 1,2,3,5,6,9,10). Its extracted values are authoritative for all visuals in this plan.
- **Reference implementation:** commit `385f7c9` ("pixel-perfect base — Roboto Flex font, Figma type scale + Button", on branch `feat/figma-design-audit`) already built the font + `Text` scale + `Button`. It is a *reference*, not a merge source — the branches have diverged; re-implement fresh from the values here. Consult it with `git show 385f7c9 -- <path>` if useful.
- **Font:** Roboto Flex variable, `font-variation-settings: 'wdth' 130` applied globally on `body`.
- **TypeScript:** `strict`; no `any`, no `// @ts-ignore`/`@ts-expect-error` without a one-line justification, no `console.log`. `PascalCase` types, no `I`-prefix. `import type { JSX } from 'react'` for return types; `ref` is a normal prop (no `forwardRef`).
- **Styling:** Tailwind utility classes only; theme via `dark:` variants (Dark is default). Compose conditional classes with `clsx`. Map to real theme tokens — no class names that resolve to nothing.
- **i18n:** no hardcoded user-facing strings; every key exists in **both** `en.ts` and `ru.ts` (parity is asserted by `shared/i18n/i18n.test.ts`).
- **Dependencies:** pin exact versions (`frontend/.npmrc` sets `save-exact=true`); no `^`/`~`.
- **Gates:** every task ends `tsc --noEmit`-clean and ESLint-clean; tests co-located as `*.test.tsx` next to source. Run gates from `frontend/`.
- **Scope guard:** touch **only** the files each task names. Do **not** modify `features/call/*` or `features/chat/*` (those in-call surfaces are M7b, after M5+M6).

---

### Task 1: Load Roboto Flex and set it as the app font

**Files:**
- Modify: `frontend/package.json` (add dependency)
- Modify: `frontend/src/main.tsx:1-3` (side-effect import)
- Modify: `frontend/src/index.css:7-21` (`--font-sans` token + `body` rule)
- Create: `frontend/src/vendor.d.ts` (module declaration for the CSS-only package)

**Interfaces:**
- Consumes: nothing.
- Produces: a global `font-sans` family (`'Roboto Flex Variable', …`) applied to `body` with `font-variation-settings: 'wdth' 130`; every later task's text renders in Roboto Flex.

- [ ] **Step 1: Install the variable font (exact-pinned)**

Run (from `frontend/`):
```bash
npm install --save-exact @fontsource-variable/roboto-flex
```
Expected: `frontend/package.json` gains `"@fontsource-variable/roboto-flex": "<exact-version>"` (no `^`/`~`), and `package-lock.json` updates.

- [ ] **Step 2: Add the TypeScript module declaration**

This package ships CSS only and has no types; `tsc -b` fails on the side-effect import without a declaration.

Create `frontend/src/vendor.d.ts`:
```ts
// CSS-only side-effect packages from @fontsource-variable have no TypeScript
// declarations — declare them here so `tsc -b` stays clean.
declare module '@fontsource-variable/roboto-flex';
```

- [ ] **Step 3: Import the font once at the app entry**

In `frontend/src/main.tsx`, add the import above `./index.css` (it registers the `@font-face` rules; order before `index.css` so the family is available when styles apply):
```ts
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/roboto-flex';
import './index.css';
import './shared/i18n';
import { App } from './App';
```

- [ ] **Step 4: Wire the `--font-sans` token and apply it on `body`**

In `frontend/src/index.css`, add the token inside `@theme` (below the surface tokens) and extend the `body` rule:
```css
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

  /* Typography — Roboto Flex variable font (Figma primary typeface) */
  --font-sans: 'Roboto Flex Variable', ui-sans-serif, system-ui, sans-serif;
}

html, body, #root { height: 100%; }
body { @apply bg-white text-slate-900 dark:bg-surface dark:text-slate-100 font-sans; font-variation-settings: 'wdth' 130; }
```

- [ ] **Step 5: Verify the build and typecheck are clean**

Run (from `frontend/`):
```bash
npm run typecheck && npm run build
```
Expected: both PASS. `tsc` finds the `vendor.d.ts` declaration; Vite bundles the font.

- [ ] **Step 6: Manual visual check**

Run `npm run dev`, open the app. Expected: body text renders in Roboto Flex (narrower, distinct from the previous system stack). Confirm no console errors about a missing font module.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/main.tsx frontend/src/index.css frontend/src/vendor.d.ts
git commit -m "feat(frontend): load Roboto Flex variable font (wdth 130) as the app font"
```

---

### Task 2: Add the missing `@theme` color tokens

**Files:**
- Modify: `frontend/src/index.css:7-18` (add three tokens inside `@theme`)

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind color utilities `bg-accent-active`/`text-accent-active`, `bg-danger-strong`/`text-danger-strong`, `text-text-muted`/`bg-text-muted` for use by M7b hover/active states and secondary text. (Overlay whites use Tailwind's built-in opacity `white/25`, `white/75` — no token needed.)

Audit §2.1 / §5 item 5: Figma has `Primary/Blue less #487CFD` (pressed/active), `Secondary/Red more #C13C3C` (danger hover), `Overlay gray #9BA6B7` (secondary/placeholder text) — all currently missing.

- [ ] **Step 1: Add the tokens**

In `frontend/src/index.css`, inside `@theme`, add below `--color-sender`:
```css
  --color-accent-active: #487cfd; /* Primary/Blue less — pressed/active */
  --color-danger-strong: #c13c3c; /* Secondary/Red more — danger hover */
  --color-text-muted: #9ba6b7;    /* Overlay gray — secondary/placeholder text */
```

- [ ] **Step 2: Verify the build resolves the new utilities**

Create a throwaway check — run (from `frontend/`):
```bash
npm run build
```
Expected: PASS (Tailwind v4 generates utilities from `@theme` tokens on demand; the build compiling proves the tokens are valid CSS).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(frontend): add accent-active, danger-strong, text-muted theme tokens (Figma)"
```

---

### Task 3: Remap `<Text>` size scale + weights to Figma

**Files:**
- Modify: `frontend/src/shared/ui/Text.tsx:24-40` (`SIZE_CLASSES`, `WEIGHT_CLASSES`)
- Test: `frontend/src/shared/ui/Text.test.tsx` (update the two class-assertion tests)

**Interfaces:**
- Consumes: the `font-sans` body font (Task 1).
- Produces: `<Text>` with Figma-correct sizes/line-heights and weights. Mapping (unchanged prop names, new class values): `2xl`→`text-[22px] leading-[30px]` (H1 22/lh30), `xl`→`text-xl leading-[28px]` (H2 20/lh28), `lg`→`text-lg leading-7`, `md`→`text-base leading-6` (body 16/lh24), `sm`→`text-sm leading-[18px]` (subtext 14/lh18), `xs`→`text-xs leading-4`. Weights: `regular`→`font-light` (300), `medium`→`font-[452]` (button label), `semibold`→`font-semibold` (600), `bold`→`font-extrabold` (800).

Audit §2.2 / §5 item 2.

- [ ] **Step 1: Update the failing tests first**

In `frontend/src/shared/ui/Text.test.tsx`, replace the default-classes assertion (line ~10) and the mapped-classes assertion (line ~21):
```tsx
  it('renders a <span> with default size/weight classes', () => {
    render(<Text>hello</Text>);
    const el = screen.getByText('hello');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('text-base', 'leading-6', 'font-light');
  });

  it('renders the requested tag with mapped size and weight classes', () => {
    render(
      <Text tag="h1" size="2xl" weight="semibold">
        title
      </Text>,
    );
    const el = screen.getByText('title');
    expect(el.tagName).toBe('H1');
    expect(el).toHaveClass('text-[22px]', 'leading-[30px]', 'font-semibold');
  });
```
Also update the `asChild` test (line ~67): `weight="bold"` now maps to `font-extrabold` — change `expect(el).toHaveClass('text-lg', 'font-bold', …)` to `expect(el).toHaveClass('text-lg', 'leading-7', 'font-extrabold', 'text-red-500', 'underline')`.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`):
```bash
npx vitest run src/shared/ui/Text.test.tsx
```
Expected: FAIL — element still has `text-2xl`/`font-normal`/`font-bold` (old scale).

- [ ] **Step 3: Rewrite the class maps to Figma values**

In `frontend/src/shared/ui/Text.tsx`, replace `SIZE_CLASSES` and `WEIGHT_CLASSES` (and their stale comments):
```tsx
// Sizes map to the Figma type scale with explicit line-heights.
// '2xl' = Figma H1 (22px/lh30), 'xl' = H2 (20px/lh28), 'md' = body (16px/lh24),
// 'sm' = subtext (14px/lh18) — NOT the Tailwind defaults (24px / lh20).
const SIZE_CLASSES: Record<TextSize, string> = {
  '2xl': 'text-[22px] leading-[30px]',
  xl: 'text-xl leading-[28px]',
  lg: 'text-lg leading-7',
  md: 'text-base leading-6',
  sm: 'text-sm leading-[18px]',
  xs: 'text-xs leading-4',
};

// Weights map to Figma Roboto Flex axis values:
// regular=300 (body), medium=452 (button label), semibold=600, bold=800 (headings).
const WEIGHT_CLASSES: Record<TextWeight, string> = {
  regular: 'font-light',
  medium: 'font-[452]',
  semibold: 'font-semibold',
  bold: 'font-extrabold',
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `frontend/`):
```bash
npx vitest run src/shared/ui/Text.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run (from `frontend/`):
```bash
npm run typecheck && npm run lint
```
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/ui/Text.tsx frontend/src/shared/ui/Text.test.tsx
git commit -m "feat(frontend): remap <Text> scale + weights to Figma (H1 22/lh30, body 300, headings 800)"
```

---

### Task 4: Rebuild `<Button>` geometry + variants to Figma

**Files:**
- Modify: `frontend/src/shared/ui/Button.tsx` (whole component)
- Test: `frontend/src/shared/ui/Button.test.tsx` (create if absent)

**Interfaces:**
- Consumes: the `font-sans` body font (Task 1); `--color-accent-strong`, `--color-danger` tokens.
- Produces: `Button` with `ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'`; base `inline-flex items-center justify-center rounded-[10px] px-7 py-3 text-base font-[452]`; primary `bg-accent … hover:bg-accent-strong`, secondary `bg-white text-surface hover:bg-white/75`, ghost `bg-transparent text-slate-200 hover:bg-surface-muted`, danger `bg-danger text-white hover:bg-danger/90`. Props unchanged plus the widened `variant`. (M4's End-call/Remove use `danger`; M7b's controls reuse this component nowhere — it stays a form/CTA button.)

Audit §3 (Button) / §5 item 3. `px-7 py-3` = 28/12px → 48px tall with 16px/lh24 text; `rounded-[10px]` = Figma 10px radius.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/ui/Button.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders Figma base geometry and the primary variant by default', () => {
    render(<Button>Join</Button>);
    const el = screen.getByRole('button', { name: 'Join' });
    expect(el).toHaveClass('rounded-[10px]', 'px-7', 'py-3', 'text-base', 'font-[452]');
    expect(el).toHaveClass('bg-accent', 'text-white', 'hover:bg-accent-strong');
    expect(el).toHaveAttribute('type', 'button');
  });

  it('renders the secondary (white) variant', () => {
    render(<Button variant="secondary">Back</Button>);
    const el = screen.getByRole('button', { name: 'Back' });
    expect(el).toHaveClass('bg-white', 'text-surface', 'hover:bg-white/75');
  });

  it('renders the danger variant', () => {
    render(<Button variant="danger">End call</Button>);
    expect(screen.getByRole('button', { name: 'End call' })).toHaveClass('bg-danger', 'text-white');
  });

  it('fires onClick and respects disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Button onClick={onClick} disabled>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1); // still 1 — disabled swallows the click
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`):
```bash
npx vitest run src/shared/ui/Button.test.tsx
```
Expected: FAIL — current button has `rounded-lg px-4 py-2 text-sm font-medium` and no `secondary`/`danger` variants.

- [ ] **Step 3: Rewrite the component**

Replace the contents of `frontend/src/shared/ui/Button.tsx`:
```tsx
import type { ReactNode } from 'react';
import type { JSX } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
};

const BASE =
  'inline-flex items-center justify-center rounded-[10px] px-7 py-3 text-base font-[452] transition disabled:opacity-40 disabled:cursor-not-allowed';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'bg-white text-surface hover:bg-white/75',
  ghost: 'bg-transparent text-slate-200 hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button' }: ButtonProps): JSX.Element {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${BASE} ${VARIANT_CLASSES[variant]}`}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `frontend/`):
```bash
npx vitest run src/shared/ui/Button.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Full gate (other screens consume Button — nothing should break)**

Run (from `frontend/`):
```bash
npm run typecheck && npm run lint && npx vitest run
```
Expected: all PASS. (Existing callers pass only `variant="primary"|"ghost"`, still valid.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/ui/Button.tsx frontend/src/shared/ui/Button.test.tsx
git commit -m "feat(frontend): rebuild <Button> to Figma (10px radius, 48px, 452 label, secondary+danger variants)"
```

---

### Task 5: Resize `<Tooltip>` to the Figma white bubble

**Files:**
- Modify: `frontend/src/shared/ui/Tooltip.tsx`
- Test: `frontend/src/shared/ui/Tooltip.test.tsx` (create if absent)

**Interfaces:**
- Consumes: the `font-sans` body font (Task 1).
- Produces: a **white** tooltip bubble — `bg-white text-surface rounded-[8px] px-3 py-1.5 text-sm font-semibold leading-[18px]` (Figma: bg white, 8px radius, padding 12/6, subtext-bold 14/lh18, 36px tall), offset 44px above the trigger (`bottom-full mb-2.5`). Prop signature (`label`, `children`, `placement`) unchanged.

Audit §3 (Tooltip): the current bubble is dark (`bg-surface-elevated text-slate-100 text-xs`) — Figma's is **white-on-dark**. (Tooltip strings are reconciled against the PRD in M7b when the state-aware control tooltips are wired — this task only fixes the bubble's *look*.)

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/ui/Tooltip.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders a white Figma bubble with the label', () => {
    render(
      <Tooltip label="Turn off camera">
        <button>cam</button>
      </Tooltip>,
    );
    const bubble = screen.getByRole('tooltip');
    expect(bubble).toHaveTextContent('Turn off camera');
    expect(bubble).toHaveClass('bg-white', 'text-surface', 'rounded-[8px]', 'px-3', 'py-1.5', 'text-sm', 'font-semibold');
  });

  it('places above the trigger by default and below when placement="bottom"', () => {
    const { rerender } = render(
      <Tooltip label="x"><button>t</button></Tooltip>,
    );
    expect(screen.getByRole('tooltip')).toHaveClass('bottom-full');

    rerender(<Tooltip label="x" placement="bottom"><button>t</button></Tooltip>);
    expect(screen.getByRole('tooltip')).toHaveClass('top-full');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `frontend/`):
```bash
npx vitest run src/shared/ui/Tooltip.test.tsx
```
Expected: FAIL — bubble has `bg-surface-elevated text-slate-100 text-xs`, not the white Figma classes.

- [ ] **Step 3: Update the bubble classes**

In `frontend/src/shared/ui/Tooltip.tsx`, change the `position` offset and the bubble `className`:
```tsx
  const position = placement === 'top' ? 'bottom-full mb-2.5' : 'top-full mt-2.5';
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 ${position} whitespace-nowrap rounded-[8px] bg-white px-3 py-1.5 text-sm font-semibold leading-[18px] text-surface opacity-0 shadow transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `frontend/`):
```bash
npx vitest run src/shared/ui/Tooltip.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run (from `frontend/`):
```bash
npm run typecheck && npm run lint
```
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/ui/Tooltip.tsx frontend/src/shared/ui/Tooltip.test.tsx
git commit -m "feat(frontend): resize Tooltip to Figma white bubble (8px radius, subtext-bold, 44px offset)"
```

---

### Task 6: Rebuild `NameInput` to the Figma field

**Files:**
- Modify: `frontend/src/features/prejoin/components/NameInput.tsx`
- Modify: `frontend/src/shared/i18n/en.ts` (add `prejoin.namePlaceholder`)
- Modify: `frontend/src/shared/i18n/ru.ts` (add `prejoin.namePlaceholder`)
- Test: `frontend/src/features/prejoin/components/NameInput.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `NameErrorKey` from `../nameValidation` (unchanged); `--color-accent`, `--color-danger` tokens.
- Produces: `NameInput` with the same props (`value`, `onChange`, `errorKey`, `showError`) rendering a Figma field — no visible label (screen-reader-only for a11y), placeholder "Name", `bg-surface-muted rounded-[11px] px-3 py-3.5 w-[332px]` (14px vertical padding → 52px tall), focus border `accent`, error border `danger`; inline error = `text-danger text-sm font-light leading-[18px]` with a `"* "` prefix span (4px gap).

Audit §4 (pre-join Input + error) / §5 item 6. Figma shows only the placeholder — the always-on label and character-help text are removed from view (the label is kept `sr-only` for accessibility per NFR-2/3; the character rules still surface via the error messages).

- [ ] **Step 1: Add the placeholder i18n key (both locales)**

In `frontend/src/shared/i18n/en.ts`, inside the `prejoin` object, add:
```ts
    namePlaceholder: 'Name',
```
In `frontend/src/shared/i18n/ru.ts`, inside the `prejoin` object, add the Russian equivalent:
```ts
    namePlaceholder: 'Имя',
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/features/prejoin/components/NameInput.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { NameInput } from './NameInput';

describe('NameInput', () => {
  it('renders the Figma field with a placeholder and no visible label text', () => {
    render(<NameInput value="" onChange={() => {}} errorKey={null} showError={false} />);
    const input = screen.getByPlaceholderText('Name');
    expect(input).toHaveClass('bg-surface-muted', 'rounded-[11px]', 'w-[332px]');
    // accessible name comes from the sr-only label, not visible chrome
    expect(input).toHaveAccessibleName('Your name');
  });

  it('shows the inline error with a "*" prefix when showError and errorKey are set', () => {
    render(<NameInput value="" onChange={() => {}} errorKey="nameEmpty" showError />);
    // getByText matches the inner message span; the color + "*" prefix live on its parent row.
    const errorRow = screen.getByText('Please enter your name').parentElement;
    expect(errorRow).toHaveClass('text-danger');
    expect(errorRow?.textContent).toMatch(/^\*/); // asterisk prefix present
  });

  it('hides the error when showError is false', () => {
    render(<NameInput value="" onChange={() => {}} errorKey="nameEmpty" showError={false} />);
    expect(screen.queryByText(/Please enter your name/)).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `frontend/`):
```bash
npx vitest run src/features/prejoin/components/NameInput.test.tsx
```
Expected: FAIL — no `placeholder`, wrong classes (`rounded-lg border-slate-700`), error uses `text-xs text-red-400` with no `*` prefix, and a visible label span exists.

- [ ] **Step 4: Rewrite the component**

Replace the contents of `frontend/src/features/prejoin/components/NameInput.tsx`:
```tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { NameErrorKey } from '../nameValidation';

export type NameInputProps = {
  value: string;
  onChange: (value: string) => void;
  errorKey: NameErrorKey | null;
  showError: boolean;
};

export function NameInput({ value, onChange, errorKey, showError }: NameInputProps): JSX.Element {
  const { t } = useTranslation('prejoin');
  const showInlineError = showError && errorKey !== null;

  return (
    <label className="flex w-[332px] flex-col items-start gap-2">
      {/* Label kept for accessibility only — Figma shows just the placeholder. */}
      <span className="sr-only">{t('nameLabel')}</span>
      <input
        value={value}
        maxLength={30}
        placeholder={t('namePlaceholder')}
        onChange={(e) => onChange(e.target.value)}
        className={`w-[332px] rounded-[11px] bg-surface-muted px-3 py-3.5 text-base font-light text-white outline-none placeholder:text-white/25 ${
          showInlineError ? 'border border-danger' : 'border border-transparent focus:border-accent'
        }`}
      />
      {showInlineError ? (
        <span className="flex items-start gap-1 text-sm font-light leading-[18px] text-danger">
          <span aria-hidden="true">*</span>
          <span>{t(errorKey)}</span>
        </span>
      ) : null}
    </label>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `frontend/`):
```bash
npx vitest run src/features/prejoin/components/NameInput.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Verify i18n parity still holds**

Run (from `frontend/`):
```bash
npx vitest run src/shared/i18n/i18n.test.ts
```
Expected: PASS — `namePlaceholder` exists in both `en.ts` and `ru.ts`.

- [ ] **Step 7: Typecheck + lint**

Run (from `frontend/`):
```bash
npm run typecheck && npm run lint
```
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/prejoin/components/NameInput.tsx frontend/src/features/prejoin/components/NameInput.test.tsx frontend/src/shared/i18n/en.ts frontend/src/shared/i18n/ru.ts
git commit -m "feat(frontend): rebuild NameInput to Figma field (332px, placeholder-only, * error)"
```

---

### Task 7: Rebuild the pre-join card layout + camera preview block

**Files:**
- Modify: `frontend/src/features/prejoin/PreJoinScreen.tsx`
- Modify: `frontend/src/features/prejoin/components/CameraPreview.tsx`
- Test: `frontend/src/features/prejoin/PreJoinScreen.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `CameraPreview`, `DeviceToggles`, `NameInput` (Task 6), `Button` (Task 4), `Text` (Task 3), `useDevicePermissions`, `validateName`, `useMediaStore`.
- Produces: the Figma pre-join card — a fixed `w-[412px] rounded-[12px] bg-surface-elevated p-10` card, centered; inner stack `flex flex-col items-center gap-3` (preview → form group); form group `flex flex-col items-center gap-6` (title → input → button). The camera preview block is `224×170` `rounded-[12px]`. A title (`<Text tag="h1" size="2xl" weight="bold">` = `"Enter your name"`) sits above the input. `DeviceToggles` render in a centered row **below** the card (Figma omits them; kept per PRD FR-10/11 in a consistent style — audit §4/§5 item 6). Permission-status messages stay, restyled with `<Text>`.

Audit §4 (pre-join card, vertical rhythm) — `p-10`=40px, `gap-3`=12px, `gap-6`=24px, `size-2xl`/`weight-bold`=H1 22/800/lh30. Title text is a new i18n key `prejoin.title`.

- [ ] **Step 1: Add the title i18n key (both locales)**

In `frontend/src/shared/i18n/en.ts` `prejoin` object add:
```ts
    title: 'Enter your name',
```
In `frontend/src/shared/i18n/ru.ts` `prejoin` object add:
```ts
    title: 'Введите ваше имя',
```

- [ ] **Step 2: Constrain the camera preview to the Figma 224×170 block**

In `frontend/src/features/prejoin/components/CameraPreview.tsx`, change the outer wrapper from the full-width `aspect-video` div to the fixed Figma block (keep the live video + mirrored self-view + camera-off icon behavior):
```tsx
  return (
    <div className="relative h-[170px] w-[224px] shrink-0 overflow-hidden rounded-[12px] bg-black">
```
(Only the outer `<div>` className changes — the `<video>` and camera-off branch stay as-is.)

- [ ] **Step 3: Write the failing test**

Create `frontend/src/features/prejoin/PreJoinScreen.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../shared/i18n';
import { PreJoinScreen } from './PreJoinScreen';

// The permissions hook touches getUserMedia — stub it to a stable shape.
vi.mock('./hooks/useDevicePermissions', () => ({
  useDevicePermissions: () => ({ previewStream: null }),
}));

describe('PreJoinScreen', () => {
  it('renders a fixed-width Figma card with the title and CTA', () => {
    render(<PreJoinScreen onEnter={() => {}} />);
    // the H1 title
    expect(screen.getByRole('heading', { name: 'Enter your name' })).toBeInTheDocument();
    // the card container carries the Figma geometry
    const card = document.querySelector('.w-\\[412px\\]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('rounded-[12px]', 'bg-surface-elevated', 'p-10');
  });

  it('labels the CTA per role (guest → Join, host → Enter call)', () => {
    const { rerender } = render(<PreJoinScreen onEnter={() => {}} role="guest" />);
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    rerender(<PreJoinScreen onEnter={() => {}} role="host" />);
    expect(screen.getByRole('button', { name: /Enter call/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run (from `frontend/`):
```bash
npx vitest run src/features/prejoin/PreJoinScreen.test.tsx
```
Expected: FAIL — no `w-[412px]` card and no `heading` (the current screen has no title element).

- [ ] **Step 5: Rebuild the screen layout**

Replace the `return (…)` block in `frontend/src/features/prejoin/PreJoinScreen.tsx` (keep the imports, hooks, and `handleSubmit` above it; add `Text` to the imports from `'../../shared/ui/Text'`):
```tsx
  return (
    <div className="mx-auto flex min-h-full flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-[412px] flex-col items-center gap-3 rounded-[12px] bg-surface-elevated p-10">
        <CameraPreview stream={previewStream} />
        <div className="flex w-full flex-col items-center gap-6">
          <Text tag="h1" size="2xl" weight="bold" className="text-white">
            {t('title')}
          </Text>
          <NameInput value={name} onChange={setName} errorKey={errorKey} showError={touched} />
          <Button type="button" onClick={handleSubmit} disabled={!valid || submitting}>
            {role === 'host' ? t('enterCall') : t('join')}
          </Button>
        </div>
      </div>

      {/* Device toggles + permission notices — not in the Figma card; kept per PRD FR-10/11. */}
      <div className="flex flex-col items-center gap-2">
        <DeviceToggles />
        {cameraPermission === 'prompt' ? (
          <Text size="sm" className="text-text-muted">{t('awaitingPermission')}</Text>
        ) : null}
        {cameraPermission === 'denied' && micPermission !== 'denied' ? (
          <Text size="sm" className="text-amber-400">{t('cameraDenied')}</Text>
        ) : null}
        {micPermission === 'denied' && cameraPermission !== 'denied' ? (
          <Text size="sm" className="text-amber-400">{t('micDenied')}</Text>
        ) : null}
        {bothDenied ? (
          <Text size="sm" className="text-amber-400">{t('bothDenied')}</Text>
        ) : null}
        {error ? (
          <Text size="sm" className="text-amber-400">{t('common:connectError')}</Text>
        ) : null}
      </div>
    </div>
  );
```

- [ ] **Step 6: Run the test to verify it passes**

Run (from `frontend/`):
```bash
npx vitest run src/features/prejoin/PreJoinScreen.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Full gate + i18n parity + manual visual**

Run (from `frontend/`):
```bash
npm run typecheck && npm run lint && npx vitest run
```
Expected: all PASS. Then `npm run dev` and confirm: 412px card, camera preview 224×170 at top, "Enter your name" H1, 332px name field, primary CTA; toggles/notices sit below the card.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/prejoin/PreJoinScreen.tsx frontend/src/features/prejoin/components/CameraPreview.tsx frontend/src/features/prejoin/PreJoinScreen.test.tsx frontend/src/shared/i18n/en.ts frontend/src/shared/i18n/ru.ts
git commit -m "feat(frontend): rebuild pre-join card to Figma (412px card, 224x170 preview, H1 title)"
```

---

### Task 8: Export and bundle the Figma icon SVGs

**Files:**
- Create: `frontend/src/shared/assets/icons/*.svg` (8 glyphs)
- Create: `frontend/src/shared/assets/icons/index.ts` (typed barrel of raw SVG markup)
- Modify: `frontend/src/vendor.d.ts` (declare `*.svg?raw` if `vite/client` types are not picked up)
- Test: `frontend/src/shared/assets/icons/icons.test.ts` (smoke test)

**Interfaces:**
- Consumes: nothing.
- Produces: `import { ICONS } from 'shared/assets/icons'` — a `Record<IconName, string>` of raw SVG markup, where `IconName = 'micOn' | 'micOff' | 'camOn' | 'camOff' | 'hangup' | 'chat' | 'arrow' | 'send' | 'screenShare'`. **M7b's controls-bar and chat-panel rebuilds consume this barrel** (audit §5 item 9 "blocks item 4").

Audit §3 (Icon set) node-ids in Figma `RhDsYTrw77YBs88mLteyUP`: `mic-on 10:3551`, `mic-off 10:3553`, `cam-on 10:3592`, `cam-off 24:2788`, `hangup 31:2862`, `chat 50:4082`, `arrow 50:4239` (16×16), `send 42:5190` (34×34). Screen-share is **not in Figma** — source it externally.

- [ ] **Step 1: Export the eight Figma glyphs as SVG**

Preferred (Figma MCP): for each node-id above, call the Figma MCP `download_assets` tool (file `RhDsYTrw77YBs88mLteyUP`) requesting SVG, saving to `frontend/src/shared/assets/icons/` as `mic-on.svg`, `mic-off.svg`, `cam-on.svg`, `cam-off.svg`, `hangup.svg`, `chat.svg`, `arrow.svg`, `send.svg`.
Fallback (no MCP): open the file in Figma, select each node by id, Export → SVG, save under the same names.
For the screen-share glyph (not in Figma), save the Lucide `monitor` SVG as `screen-share.svg` (dark glyph, `viewBox="0 0 24 24"`, `stroke="currentColor"`).
Expected: nine `.svg` files present in `frontend/src/shared/assets/icons/`.

- [ ] **Step 2: Ensure `*.svg?raw` imports typecheck**

Vite's `vite/client` types declare `*.svg?raw` as `string`. If `tsconfig.app.json` does not include `"vite/client"` in `types`/`compilerOptions.types` (verify), add this line to `frontend/src/vendor.d.ts`:
```ts
declare module '*.svg?raw' { const content: string; export default content; }
```
(Skip if `vite/client` is already referenced and `tsc` is clean after Step 3.)

- [ ] **Step 3: Create the typed barrel**

Create `frontend/src/shared/assets/icons/index.ts`:
```ts
import micOn from './mic-on.svg?raw';
import micOff from './mic-off.svg?raw';
import camOn from './cam-on.svg?raw';
import camOff from './cam-off.svg?raw';
import hangup from './hangup.svg?raw';
import chat from './chat.svg?raw';
import arrow from './arrow.svg?raw';
import send from './send.svg?raw';
import screenShare from './screen-share.svg?raw';

export type IconName =
  | 'micOn' | 'micOff' | 'camOn' | 'camOff'
  | 'hangup' | 'chat' | 'arrow' | 'send' | 'screenShare';

// Raw SVG markup, imported at build time. M7b inlines these into the control
// buttons and chat panel (enables aria-labels + Tailwind sizing on the <svg>).
export const ICONS: Record<IconName, string> = {
  micOn, micOff, camOn, camOff, hangup, chat, arrow, send, screenShare,
};
```

- [ ] **Step 4: Write the smoke test**

Create `frontend/src/shared/assets/icons/icons.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ICONS, type IconName } from './index';

const NAMES: IconName[] = ['micOn', 'micOff', 'camOn', 'camOff', 'hangup', 'chat', 'arrow', 'send', 'screenShare'];

describe('icon barrel', () => {
  it('exports valid SVG markup for every glyph', () => {
    for (const name of NAMES) {
      expect(ICONS[name], name).toContain('<svg');
    }
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `frontend/`):
```bash
npx vitest run src/shared/assets/icons/icons.test.ts
```
Expected: PASS — all nine imports resolve to SVG markup.

- [ ] **Step 6: Full gate**

Run (from `frontend/`):
```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all PASS (the build proves Vite resolves every `?raw` import).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/assets/icons/ frontend/src/vendor.d.ts
git commit -m "feat(frontend): export + bundle Figma icon SVGs for the controls/chat rebuild (M7b)"
```

---

## Definition of done (M7a)

- Roboto Flex loads and is the app font (`wdth 130`); `<Text>` and `<Button>` render Figma sizes/weights/geometry; the three missing tokens exist.
- `Tooltip` is the white Figma bubble; `NameInput` is the 332px placeholder-only field with the `* ` error; the pre-join screen is the 412px Figma card with a 224×170 preview and H1 title.
- Nine icon SVGs are bundled and exported via `ICONS` for M7b.
- `npm run typecheck`, `npm run lint`, and `npx vitest run` all pass from `frontend/`.
- **Then smoke the real stack** (per rule `60-testing.md`): `docker compose up --build`, open the pre-join screen, and eyeball it against Figma Welcome-1/2/3 — green unit gates are not proof it looks right.

## Out of scope (deferred to M7b, after M5 + M6)

Controls bar (round icon controls, colors, screen-share slot, copy-link reposition), video-grid geometry (gaps/widths/aspect/1–4 layouts), and the chat panel + message items + input rebuild. M7b consumes this plan's `Button`, `Text`, `Tooltip`, tokens, and `ICONS`.
