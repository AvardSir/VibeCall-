# M7b — Figma Pixel-Perfect: In-Call Rebuilds (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every **Figma-covered in-call surface** pixel-perfect — the V2 controls bar (round icon controls), the adaptive video grid geometry + tiles, and the chat panel + message items + input — reusing the M7a design system (`Button`, `Text`, `Tooltip`, tokens, `ICONS`).

**Architecture:** Frontend-only. Introduce two shared primitives (`Icon`, `ControlButton`) that inline the M7a-bundled SVG glyphs, then rebuild the three composed in-call areas (`features/call/*`, `features/chat/*`) to the audit's V2 geometry. No backend, no new PRD behavior — M7b restyles surfaces that M4/M5/M6 have already made *functional*; it must **preserve** their behavior (host end/remove, chat attachments + lightbox, screen share).

**Tech Stack:** React 19 + TypeScript, Vite 8, Tailwind CSS v4, Vitest 4 + @testing-library/react, `@livekit/components-react`, react-i18next.

> ⚠ **Plan freshness — read before executing (critical for M7b).** This plan was written **ahead of time**, while M5 (chat attachments) and M6 (screen share) were still in development, but M7b **executes last (after M5 + M6 land)** and **rebuilds the very files M5/M6 modify** (`ControlsBar.tsx`, `ChatInput.tsx`, `ChatPanel.tsx`, `MessageList.tsx`, `VideoGrid.tsx`). The snapshots below reflect the codebase *at authoring time* and **will have drifted** — M5 will have added attachment staging to `ChatInput`/`ChatPanel`; M6 will have added a screen-share control to `ControlsBar` and a share layout to the grid. For every task: **(1) re-read the actual current file first** (the shown `old_string`/structure may differ), **(2) preserve all M5/M6 behavior** you find (do not delete attachment staging, the lightbox, share arbitration, or their tests) — restyle around it, **(3) wire the screen-share control (Task 2) to M6's real API** (hook/props/store) rather than the placeholder shown here, **(4) re-confirm values against the audit** (`docs/superpowers/design/2026-07-01-figma-conformance-audit.md`, §3–§5). The TDD gates are the backstop — trust them over the literal snapshots. If a task's premise no longer holds, flag it and adapt.

## Global Constraints

- **Source of truth:** Figma Conformance Audit `docs/superpowers/design/2026-07-01-figma-conformance-audit.md` — §3 (control button, video container, chat panel/message/input), §4 (room grids, controls bar), §5 items **4, 7, 8**. Its extracted V2 values are authoritative.
- **Authoritative clarifications (audit §0 "Design decisions log") override any conflicting prose elsewhere in the audit.** In particular **item 9: the chat input stays MULTI-LINE (`<textarea>`)** — a deliberate accepted deviation from Figma's single-line field. M7b **keeps the textarea** and only restyles it; §3/§5's "single-line input" wording is superseded.
- **Depends on M7a** (`docs/superpowers/plans/2026-07-01-m7a-figma-foundation.md`): consumes `ICONS` (`shared/assets/icons`), the Figma-correct `Button`/`Text`/`Tooltip`, and tokens `accent-active`/`danger-strong`/`text-muted`. **Depends on M5 + M6** (their features must already exist and must survive this restyle).
- **TypeScript:** `strict`; no `any`, no unjustified `@ts-ignore`, no `console.log`. `PascalCase` types, no `I`-prefix. `import type { JSX } from 'react'`; `ref` is a normal prop.
- **Styling:** Tailwind only; theme via `dark:` variants; compose conditional classes with `clsx`. Real theme tokens only (`bg-surface`, `bg-accent`, `bg-danger`, `bg-accent-strong`, `bg-danger-strong`, `text-sender`, `text-accent`).
- **i18n:** no hardcoded strings; every new key in **both** `en.ts` and `ru.ts` (parity asserted by `shared/i18n/i18n.test.ts`).
- **Gates:** each task ends `tsc --noEmit`-clean, ESLint-clean, and with the full `npx vitest run` green. Co-locate tests. Run from `frontend/`.
- **V2 geometry reference values:** control button `size-12 rounded-[30px]`, glyph `30×30`; controls-bar gap `16px` (`gap-4`); grid gap `16px` (`gap-4`); per-count grid widths 1-up `1220`, 2-up `1382`, 3/4-up `1168`; tiles `16:9` `rounded-[12px]`; chat panel `w-[340px] bg-surface-elevated`; message bubble `bg-surface rounded-[12px]`, own sender `text-accent`, others `text-sender`. **4-up has no V2 frame → reuse V1 2×2 geometry** (audit §4) with a comment noting it was unconfirmed.

---

### Task 1: `Icon` + `ControlButton` shared primitives

**Files:**
- Create: `frontend/src/shared/ui/Icon.tsx`
- Create: `frontend/src/shared/ui/ControlButton.tsx`
- Test: `frontend/src/shared/ui/Icon.test.tsx`
- Test: `frontend/src/shared/ui/ControlButton.test.tsx`

**Interfaces:**
- Consumes: `ICONS` + `IconName` from `shared/assets/icons` (M7a Task 8).
- Produces:
  - `Icon({ name: IconName; className?: string })` — inlines the bundled SVG markup, sized/colored via `className`, `aria-hidden`.
  - `ControlButton({ icon: IconName; label: string; onClick: () => void; variant?: ControlVariant; disabled?: boolean })` where `ControlVariant = 'white' | 'dark' | 'danger' | 'active'`; renders a 48px round button (`size-12 rounded-[30px]`) with a 30×30 glyph and `aria-label={label}`. Variants: `white` = `bg-white text-surface hover:bg-white/75`; `dark` = `bg-surface-elevated text-white hover:bg-surface-muted`; `danger` = `bg-danger text-white hover:bg-danger-strong`; `active` = `bg-accent text-white hover:bg-accent-strong`. **Consumed by Tasks 2 + 3.**

- [ ] **Step 1: Write the failing Icon test**

Create `frontend/src/shared/ui/Icon.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('inlines the bundled SVG markup for the named glyph', () => {
    const { container } = render(<Icon name="micOn" className="h-[30px] w-[30px]" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveClass('h-[30px]', 'w-[30px]');
    expect(wrapper.innerHTML).toContain('<svg');
    expect(wrapper).toHaveAttribute('aria-hidden');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Icon` does not exist)

Run: `npx vitest run src/shared/ui/Icon.test.tsx` → FAIL.

- [ ] **Step 3: Implement `Icon`**

Create `frontend/src/shared/ui/Icon.tsx`:
```tsx
import type { JSX } from 'react';
import clsx from 'clsx';
import { ICONS, type IconName } from '../assets/icons';

export type IconProps = { name: IconName; className?: string };

// First-party bundled SVG markup (shared/assets/icons) — trusted, not user content.
// Inlined so the glyph inherits currentColor and is sized via className.
export function Icon({ name, className }: IconProps): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={clsx('inline-flex [&>svg]:h-full [&>svg]:w-full', className)}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run src/shared/ui/Icon.test.tsx` → PASS.

- [ ] **Step 5: Write the failing ControlButton test**

Create `frontend/src/shared/ui/ControlButton.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlButton } from './ControlButton';

describe('ControlButton', () => {
  it('renders a 48px round button with an accessible label and the glyph', () => {
    const { container } = render(<ControlButton icon="micOn" label="Mute microphone" onClick={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Mute microphone' });
    expect(btn).toHaveClass('size-12', 'rounded-[30px]');
    expect(btn).toHaveClass('bg-white', 'text-surface'); // default variant = white
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('maps variants to Figma classes', () => {
    const { rerender } = render(<ControlButton icon="hangup" label="End call" onClick={() => {}} variant="danger" />);
    expect(screen.getByRole('button', { name: 'End call' })).toHaveClass('bg-danger', 'hover:bg-danger-strong');
    rerender(<ControlButton icon="chat" label="Chat" onClick={() => {}} variant="active" />);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveClass('bg-accent', 'hover:bg-accent-strong');
    rerender(<ControlButton icon="chat" label="Chat" onClick={() => {}} variant="dark" />);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveClass('bg-surface-elevated', 'text-white');
  });

  it('fires onClick and respects disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<ControlButton icon="camOn" label="cam" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'cam' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ControlButton icon="camOn" label="cam" onClick={onClick} disabled />);
    await userEvent.click(screen.getByRole('button', { name: 'cam' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run it — expect FAIL**

Run: `npx vitest run src/shared/ui/ControlButton.test.tsx` → FAIL.

- [ ] **Step 7: Implement `ControlButton`**

Create `frontend/src/shared/ui/ControlButton.tsx`:
```tsx
import type { JSX } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';
import type { IconName } from '../assets/icons';

export type ControlVariant = 'white' | 'dark' | 'danger' | 'active';

export type ControlButtonProps = {
  icon: IconName;
  label: string;
  onClick: () => void;
  variant?: ControlVariant;
  disabled?: boolean;
};

const VARIANT_CLASSES: Record<ControlVariant, string> = {
  white: 'bg-white text-surface hover:bg-white/75',
  dark: 'bg-surface-elevated text-white hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger-strong',
  active: 'bg-accent text-white hover:bg-accent-strong',
};

export function ControlButton({ icon, label, onClick, variant = 'white', disabled }: ControlButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex size-12 items-center justify-center rounded-[30px] transition disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
      )}
    >
      <Icon name={icon} className="h-[30px] w-[30px]" />
    </button>
  );
}
```

- [ ] **Step 8: Run tests + gates**

Run (from `frontend/`):
```bash
npx vitest run src/shared/ui/ControlButton.test.tsx src/shared/ui/Icon.test.tsx && npm run typecheck && npm run lint
```
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/shared/ui/Icon.tsx frontend/src/shared/ui/Icon.test.tsx frontend/src/shared/ui/ControlButton.tsx frontend/src/shared/ui/ControlButton.test.tsx
git commit -m "feat(frontend): add Icon + ControlButton primitives (V2 round icon controls)"
```

---

### Task 2: Rebuild the controls-bar center controls to V2

**Files:**
- Modify: `frontend/src/features/call/components/ControlsBar.tsx`
- Modify: `frontend/src/features/call/components/ControlsBar.test.tsx`

**Interfaces:**
- Consumes: `ControlButton` (Task 1), `Tooltip` (M7a); `useMediaStore` (`isMicOn`/`isCamOn`/`setMicOn`/`setCamOn`), the local-participant track reconciliation (unchanged), and **M6's screen-share API** (see freshness note — wire the share control to whatever M6 exposed).
- Produces: a centered control row rendering **mic · camera · [screen-share] · end/leave** as round `ControlButton`s inside `Tooltip`s. mic/cam = `white` variant with glyph `micOn|micOff`/`camOn|camOff`; end/leave = `danger` variant, glyph `hangup`, calls `onEndCall` (host) or `onLeave` (guest). The chat + copy-link controls move to a bottom-right group in **Task 3**.

Audit §3/§4 (controls bar) / §5 item 4. Keep the existing `useEffect` track reconciliation and `ControlsBarProps` exactly as they are.

- [ ] **Step 1: Update the failing tests**

In `frontend/src/features/call/components/ControlsBar.test.tsx`, adjust the mic/cam and end/leave assertions to the new round controls (labels come from the existing tooltip strings; the accessible name is now the control's `aria-label`). Add/replace:
```tsx
  it('toggles the mic via the round control', async () => {
    // (render ControlsBar within its existing test harness/providers)
    const micBtn = screen.getByRole('button', { name: /microphone/i });
    await userEvent.click(micBtn);
    expect(setMicOn).toHaveBeenCalledWith(false); // or the harness's spy equivalent
  });

  it('shows a red end-call control for the host and a leave control for a guest', () => {
    // host render → end call
    expect(screen.getByRole('button', { name: /end the call/i })).toHaveClass('bg-danger');
    // guest render → leave
    // expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
  });
```
> Reconcile the exact label text with the current `call` i18n (`micTooltipOn/Off`, `cameraTooltipOn/Off`, `endCallTooltip`, `leaveTooltip`) — use those as the `ControlButton` `label` so the tooltip text and the accessible name are the same string.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/features/call/components/ControlsBar.test.tsx` → FAIL (still `Toggle`/text buttons).

- [ ] **Step 3: Rebuild the center controls**

In `frontend/src/features/call/components/ControlsBar.tsx`, keep the imports/hooks/`useEffect`s, and replace the mic/cam `Toggle`s and the end/leave text buttons with round controls. The center row:
```tsx
  return (
    <div className="flex items-center justify-center gap-4 p-4">
      <Tooltip label={isMicOn ? t('micTooltipOn') : t('micTooltipOff')}>
        <ControlButton
          icon={isMicOn ? 'micOn' : 'micOff'}
          label={isMicOn ? t('micTooltipOn') : t('micTooltipOff')}
          onClick={() => setMicOn(!isMicOn)}
        />
      </Tooltip>
      <Tooltip label={isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff')}>
        <ControlButton
          icon={isCamOn ? 'camOn' : 'camOff'}
          label={isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff')}
          onClick={() => setCamOn(!isCamOn)}
        />
      </Tooltip>

      {/* Screen-share (3rd control) — WIRE TO M6's real API at execution (hook/props/store).
          Placeholder shape: render only when M6's share handler is available; white idle,
          'active' while sharing, disabled+busy tooltip when someone else shares. */}
      {/* <Tooltip label={shareTooltip}>
        <ControlButton icon="screenShare" label={shareTooltip} variant={isSharing ? 'active' : 'white'}
          onClick={onToggleShare} disabled={shareBusy} />
      </Tooltip> */}

      {role === 'host' ? (
        <Tooltip label={t('endCallTooltip')}>
          <ControlButton icon="hangup" label={t('endCallTooltip')} variant="danger" onClick={onEndCall} />
        </Tooltip>
      ) : (
        <Tooltip label={t('leaveTooltip')}>
          <ControlButton icon="hangup" label={t('leaveTooltip')} variant="danger" onClick={onLeave} />
        </Tooltip>
      )}
    </div>
  );
```
Add `import { ControlButton } from '../../../shared/ui/ControlButton';`. Remove the now-unused `Toggle`/`Button` imports **if** nothing else in the file uses them (the chat + copy-link markup is still present until Task 3 — leave it in place for now; this step only swaps mic/cam/end-leave). Uncomment + wire the screen-share block against M6's actual API.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/features/call/components/ControlsBar.test.tsx` → PASS.

- [ ] **Step 5: Gates**

Run: `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/call/components/ControlsBar.tsx frontend/src/features/call/components/ControlsBar.test.tsx
git commit -m "feat(frontend): rebuild controls-bar center controls to V2 round icon buttons"
```

---

### Task 3: Move chat + copy-link to the bottom-right group

**Files:**
- Modify: `frontend/src/features/call/components/ControlsBar.tsx`
- Modify: `frontend/src/features/call/components/ControlsBar.chat.test.tsx`
- Modify: `frontend/src/features/call/components/CopyLinkButton.tsx`
- Modify: `frontend/src/features/call/components/CopyLinkButton.test.tsx`
- Create: `frontend/src/shared/assets/icons/link.svg` (external Lucide `link` glyph, `stroke="currentColor"`)
- Modify: `frontend/src/shared/assets/icons/index.ts` (add `link` to `ICONS`/`IconName`)

**Interfaces:**
- Consumes: `ControlButton` (Task 1); `useChatStore` (`unreadCount`/`togglePanel`/`isPanelOpen`/`markAllRead`).
- Produces: a bottom-right absolutely-positioned group `Copy link · Chat` (host sees both; guest sees only Chat). Chat control = `ControlButton icon="chat"`, `variant="dark"` when the panel is closed / `variant="active"` when open, with the unread badge overlaid. `CopyLinkButton` becomes a round `white` `ControlButton` (glyph `link`) keeping its copied/failed feedback.

Audit §0.6 / §3 (bottom-right group). The center bar (Task 2) keeps only mic/cam/share/end-leave.

- [ ] **Step 1: Add the `link` glyph to the icon set**

Save the Lucide `link` SVG (viewBox `0 0 24 24`, `stroke="currentColor"`, no fill) to `frontend/src/shared/assets/icons/link.svg`. In `frontend/src/shared/assets/icons/index.ts`, add the import + entry:
```ts
import link from './link.svg?raw';
// … add 'link' to the IconName union and the ICONS record.
```
Extend `IconName` with `| 'link'` and add `link,` to the `ICONS` object.

- [ ] **Step 2: Update the failing tests**

In `CopyLinkButton.test.tsx`, change the trigger query from text to the accessible label (`{ name: t('copyLink') }` → the button now carries `aria-label`), and assert the round classes:
```tsx
    const btn = screen.getByRole('button', { name: 'Copy link' });
    expect(btn).toHaveClass('size-12', 'rounded-[30px]', 'bg-white');
```
In `ControlsBar.chat.test.tsx`, assert the chat control's variant flips with the panel:
```tsx
    // panel closed → dark; open → active (blue)
    expect(screen.getByRole('button', { name: /chat/i })).toHaveClass('bg-surface-elevated');
    // after togglePanel/open: expect …toHaveClass('bg-accent')
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run src/features/call/components/CopyLinkButton.test.tsx src/features/call/components/ControlsBar.chat.test.tsx` → FAIL.

- [ ] **Step 4: Rebuild `CopyLinkButton` as a round control**

Replace the button markup in `frontend/src/features/call/components/CopyLinkButton.tsx` (keep the `handleCopy`/state/timer logic and the copied/failed feedback spans; wrap in a Tooltip for the label):
```tsx
  return (
    <div className="relative flex flex-col items-center">
      <Tooltip label={t('copyLink')}>
        <ControlButton icon="link" label={t('copyLink')} onClick={() => void handleCopy()} />
      </Tooltip>
      {state === 'copied' ? (
        <span className="absolute -top-9 whitespace-nowrap text-xs text-emerald-400">{t('linkCopied')}</span>
      ) : null}
      {state === 'failed' ? (
        <div className="absolute -top-16 w-72 rounded-md bg-surface-muted p-2 text-xs text-slate-200">
          <p>{t('copyFailed')}</p>
          <p className="select-all break-all font-mono">{url}</p>
        </div>
      ) : null}
    </div>
  );
```
Add imports for `ControlButton` and `Tooltip`.

- [ ] **Step 5: Move the chat + copy-link group in `ControlsBar`**

In `frontend/src/features/call/components/ControlsBar.tsx`, wrap the whole return in a relative container and render the group bottom-right; replace the old text chat `<button>` with a `ControlButton`:
```tsx
  return (
    <div className="relative p-4">
      <div className="flex items-center justify-center gap-4">
        {/* mic · cam · [screen-share] · end/leave from Task 2 */}
      </div>

      <div className="absolute bottom-4 right-7 flex items-center gap-4">
        {role === 'host' ? <CopyLinkButton url={participantUrl} /> : null}
        <div className="relative">
          <Tooltip label={tc('openChat')}>
            <ControlButton
              icon="chat"
              label={tc('openChat')}
              variant={isPanelOpen ? 'active' : 'dark'}
              onClick={handleToggleChat}
            />
          </Tooltip>
          {unreadCount > 0 && (
            <span
              data-testid="chat-unread"
              className="pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs text-white"
            >
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
```
Now remove the unused `Toggle`/`Button` imports if the file no longer references them.

- [ ] **Step 6: Run tests + gates + full suite**

Run (from `frontend/`):
```bash
npx vitest run src/features/call/components/CopyLinkButton.test.tsx src/features/call/components/ControlsBar.chat.test.tsx src/shared/assets/icons/icons.test.ts && npm run typecheck && npm run lint
```
Expected: all PASS (extend `icons.test.ts`'s name list with `'link'` if it enumerates names).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/call/components/ControlsBar.tsx frontend/src/features/call/components/ControlsBar.chat.test.tsx frontend/src/features/call/components/CopyLinkButton.tsx frontend/src/features/call/components/CopyLinkButton.test.tsx frontend/src/shared/assets/icons/
git commit -m "feat(frontend): move chat + copy-link to bottom-right V2 control group"
```

---

### Task 4: Video-grid geometry (gap, widths, aspect)

**Files:**
- Modify: `frontend/src/features/call/components/VideoGrid.tsx`
- Modify: `frontend/src/features/call/components/VideoGrid.test.tsx`

**Interfaces:**
- Consumes: `VideoTile` (Task 5), `useParticipants`, `useParticipantsStore`, `useTracks` (all unchanged).
- Produces: the grid with `gap-4` (16px), a per-count `max-w-*` cap (1-up `max-w-[1220px]`, 2-up `max-w-[1382px]`, 3/4-up `max-w-[1168px]`), and each tile wrapper forced to `aspect-video` (16:9). Layout rules (1→full, 2→L/R, 3→two-top+centered-bottom, 4→2×2) unchanged.

Audit §4 (room grids) / §5 item 7.

- [ ] **Step 1: Update the failing test**

In `frontend/src/features/call/components/VideoGrid.test.tsx`, assert the new gap + per-count width. Example:
```tsx
    // with 2 participants
    const grid = screen.getByTestId('video-grid');
    expect(grid).toHaveClass('gap-4', 'max-w-[1382px]');
```
(Adjust the participant-count setup to the harness already used in this file; add a case for 1-up `max-w-[1220px]` and 3-up `max-w-[1168px]`.)

- [ ] **Step 2: Run — expect FAIL** (`gap-3`, `max-w-5xl`).

Run: `npx vitest run src/features/call/components/VideoGrid.test.tsx` → FAIL.

- [ ] **Step 3: Apply the geometry**

In `frontend/src/features/call/components/VideoGrid.tsx`, add a width map and use it; change the gap; force aspect on each cell:
```tsx
const GRID_MAX_WIDTH: Record<number, string> = {
  1: 'max-w-[1220px]',
  2: 'max-w-[1382px]',
  3: 'max-w-[1168px]',
  4: 'max-w-[1168px]',
};
```
Then in the render, replace the grid container className and the per-tile wrapper:
```tsx
      <div
        data-testid="video-grid"
        data-count={count}
        className={`grid w-full place-content-center gap-4 ${GRID_MAX_WIDTH[count] ?? 'max-w-[1168px]'} ${layout}`}
      >
        {participants.map((p, index) => {
          const centerBottom =
            count === 3 && index === 2 ? 'col-span-2 w-1/2 justify-self-center' : '';
          return (
            <div key={p.identity} className={`aspect-video min-h-0 ${centerBottom}`}>
              <VideoTile /* …unchanged props… */ />
            </div>
          );
        })}
      </div>
```
Keep the `count === 1` "Waiting…" overlay.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/features/call/components/VideoGrid.test.tsx` → PASS.

- [ ] **Step 5: Gates + manual check**

Run: `npm run typecheck && npm run lint`. Then `npm run dev`: confirm 1/2/3/4-participant layouts match Figma widths, 16px gaps, and 16:9 tiles.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/call/components/VideoGrid.tsx frontend/src/features/call/components/VideoGrid.test.tsx
git commit -m "feat(frontend): apply V2 grid geometry (gap-4, per-count widths, 16:9 tiles)"
```

---

### Task 5: `VideoTile` Figma styling (radius, name pill, mic icon)

**Files:**
- Modify: `frontend/src/features/call/components/VideoTile.tsx`
- Modify: `frontend/src/features/call/components/VideoTile.test.tsx`

**Interfaces:**
- Consumes: `Icon` (Task 1), `VideoTrack`, `Tooltip`. Props unchanged (`VideoTileProps`).
- Produces: tile root `rounded-[12px] bg-surface-elevated`; **camera-off** = centered `micOn|micOff` glyph (SVG via `Icon`, not the emoji) above the name, wrapped in a `bg-[rgba(31,34,36,0.5)] rounded-[9px]` pill; **live video** name label = bottom-left pill `bg-[rgba(31,34,36,0.5)] rounded-[9px]` with a 20px mic glyph + name (`text-sm font-light`); muted-mic corner indicator = `micOff` glyph.

Audit §3 (Video container). Replaces the 🎤/🔇 emoji with real glyphs.

- [ ] **Step 1: Update the failing test**

In `frontend/src/features/call/components/VideoTile.test.tsx`, replace the emoji-based assertions. For the camera-off case (no track / camera disabled) assert an SVG renders instead of emoji text, and the radius:
```tsx
    const { container } = render(/* VideoTile camera off, mic on */);
    expect(container.querySelector('[data-testid="center-mic"] svg')).not.toBeNull();
    expect(container.firstElementChild).toHaveClass('rounded-[12px]');
```
For the muted-corner case (camera on, mic off) assert the corner indicator contains an svg.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/features/call/components/VideoTile.test.tsx` → FAIL (still emoji, `rounded-xl`).

- [ ] **Step 3: Restyle the tile**

In `frontend/src/features/call/components/VideoTile.tsx`, add `import { Icon } from '../../../shared/ui/Icon';`, change the root to `rounded-[12px] bg-surface-elevated`, and swap the emoji spans. Live-video name label + corner mute:
```tsx
          {!isMicrophoneEnabled && (
            <span
              data-testid="corner-mute"
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-[rgba(31,34,36,0.5)]"
            >
              <Icon name="micOff" className="h-4 w-4 text-white" />
            </span>
          )}
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-[9px] bg-[rgba(31,34,36,0.5)] py-1 pl-1.5 pr-2.5">
            <Icon name={isMicrophoneEnabled ? 'micOn' : 'micOff'} className="h-5 w-5 text-white" />
            <span className="text-sm font-light text-white">{label}</span>
          </span>
```
Camera-off centered content:
```tsx
        <div className="grid h-full place-items-center">
          <div className="flex flex-col items-center gap-2 rounded-[9px] bg-[rgba(31,34,36,0.5)] px-4 py-3">
            <span data-testid="center-mic">
              <Icon name={isMicrophoneEnabled ? 'micOn' : 'micOff'} className="h-8 w-8 text-white" />
            </span>
            <span className="text-xl font-extrabold leading-[28px] text-white">{label}</span>
          </div>
        </div>
```
Keep the `onRemove` host control (it can keep its current styling — the remove button is not in Figma).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/features/call/components/VideoTile.test.tsx` → PASS.

- [ ] **Step 5: Gates**

Run: `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/call/components/VideoTile.tsx frontend/src/features/call/components/VideoTile.test.tsx
git commit -m "feat(frontend): style VideoTile to Figma (12px radius, mic-glyph name pill, camera-off content)"
```

---

### Task 6: `ChatMessageItem` + message grouping to Figma

**Files:**
- Modify: `frontend/src/features/chat/components/ChatMessageItem.tsx`
- Modify: `frontend/src/features/chat/components/MessageList.tsx`
- Modify: `frontend/src/features/chat/components/MessageList.test.tsx`
- Create: `frontend/src/features/chat/components/ChatMessageItem.test.tsx`

**Interfaces:**
- Consumes: `ChatItem` (`senderIdentity`, `senderName`, `sentAt`, `text`, `status`, `key`).
- Produces: `ChatMessageItemProps = { item: ChatItem; isOwn: boolean; isFirstInGroup: boolean }`. Sender-name line 14px/`font-semibold`, `text-accent` (own) / `text-sender` (others). Bubble `bg-surface px-3 py-2.5` with radius `rounded-[12px]` when first-in-group, else one inner corner cut to `rounded-*-[4px]` (others: `rounded-tl-[4px]`; own: `rounded-tr-[4px]`). Message text + timestamp inline: `text-sm font-light text-white` then ` · ` then `text-white/50`. `MessageList` computes `isFirstInGroup` (sender differs from previous item) and passes it. **Preserve any M5 attachment rendering** (image thumbnails / file chips) already present in this component.

Audit §3 (single message item).

- [ ] **Step 1: Write the failing ChatMessageItem test**

Create `frontend/src/features/chat/components/ChatMessageItem.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { ChatMessageItem } from './ChatMessageItem';
import type { ChatItem } from '../../../stores/useChatStore';

const base: ChatItem = {
  key: 'k1', senderIdentity: 'u1', senderName: 'Ann', sentAt: 0, text: 'hi', status: 'delivered',
};

describe('ChatMessageItem', () => {
  it('colors the sender name blue for own and purple for others', () => {
    const { rerender } = render(<ChatMessageItem item={base} isOwn isFirstInGroup />);
    expect(screen.getByText('Ann')).toHaveClass('text-accent');
    rerender(<ChatMessageItem item={base} isOwn={false} isFirstInGroup />);
    expect(screen.getByText('Ann')).toHaveClass('text-sender');
  });

  it('uses the Figma bubble background + full radius for the first bubble in a group', () => {
    render(<ChatMessageItem item={base} isOwn={false} isFirstInGroup />);
    expect(screen.getByTestId('chat-text')).toHaveClass('bg-surface', 'rounded-[12px]');
  });

  it('cuts the inner corner for subsequent bubbles (audit §3: bottom corner)', () => {
    render(<ChatMessageItem item={base} isOwn={false} isFirstInGroup={false} />);
    expect(screen.getByTestId('chat-text')).toHaveClass('rounded-bl-[4px]'); // others; own → rounded-br-[4px]
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/features/chat/components/ChatMessageItem.test.tsx` → FAIL.

- [ ] **Step 3: Rebuild `ChatMessageItem`**

Rewrite `frontend/src/features/chat/components/ChatMessageItem.tsx` (preserve any M5 attachment block you find — add it back below the text):
```tsx
import type { JSX } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { ChatItem } from '../../../stores/useChatStore';

export type ChatMessageItemProps = { item: ChatItem; isOwn: boolean; isFirstInGroup: boolean };

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessageItem({ item: m, isOwn, isFirstInGroup }: ChatMessageItemProps): JSX.Element {
  const { t } = useTranslation('chat');
  // Audit §3: first bubble in a sender group = full 12px; subsequent bubbles cut the inner BOTTOM
  // corner to 4px (others → bottom-left, own → bottom-right). Verify the group direction visually.
  const radius = isFirstInGroup
    ? 'rounded-[12px]'
    : clsx('rounded-[12px]', isOwn ? 'rounded-br-[4px]' : 'rounded-bl-[4px]');

  return (
    <li className={isOwn ? 'self-end' : 'self-start'}>
      {isFirstInGroup && (
        <div className={clsx('mb-1 text-sm font-semibold leading-[18px]', isOwn ? 'text-accent' : 'text-sender')}>
          {m.senderName}
        </div>
      )}
      <div
        data-testid="chat-text"
        className={clsx('inline-block max-w-[280px] whitespace-pre-wrap break-words bg-surface px-3 py-2.5', radius)}
      >
        <span className="text-sm font-light leading-[18px] text-white">{m.text}</span>
        <span className="text-sm text-white/50"> · {formatTime(m.sentAt)}</span>
        {/* PRESERVE M5: render attachment thumbnails / file chips here if present in the pre-M7b version. */}
      </div>
      {isOwn && m.status === 'sending' && <div className="text-xs text-slate-500">{t('sending')}</div>}
      {isOwn && m.status === 'failed' && <div className="text-xs text-danger">{t('notDelivered')}</div>}
    </li>
  );
}
```

- [ ] **Step 4: Pass `isFirstInGroup` from `MessageList`**

In `frontend/src/features/chat/components/MessageList.tsx`, compute grouping and pass it:
```tsx
      {items.map((m, i) => (
        <ChatMessageItem
          key={m.key}
          item={m}
          isOwn={m.senderIdentity === selfIdentity}
          isFirstInGroup={i === 0 || items[i - 1].senderIdentity !== m.senderIdentity}
        />
      ))}
```
Update `MessageList.test.tsx` if it asserted the old message markup.

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx vitest run src/features/chat/components/ChatMessageItem.test.tsx src/features/chat/components/MessageList.test.tsx` → PASS.

- [ ] **Step 6: Gates**

Run: `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/chat/components/ChatMessageItem.tsx frontend/src/features/chat/components/ChatMessageItem.test.tsx frontend/src/features/chat/components/MessageList.tsx frontend/src/features/chat/components/MessageList.test.tsx
git commit -m "feat(frontend): style chat messages to Figma (sender colors, bubble radii, inline timestamp)"
```

---

### Task 7: `ChatPanel` to the Figma docked panel

**Files:**
- Modify: `frontend/src/features/chat/ChatPanel.tsx`
- Modify: `frontend/src/features/chat/ChatPanel.test.tsx`
- Modify: `frontend/src/shared/i18n/en.ts` + `ru.ts` (add `chat.closeChat`)

**Interfaces:**
- Consumes: `useChatStore` (`isPanelOpen`, `togglePanel`), `Text` + `Icon` (M7a/Task 1), `MessageList`, `ChatInput`. Props unchanged (`ChatPanelProps`).
- Produces: panel `w-[340px] bg-surface-elevated`, full height; header row (`px-6 pt-6`) = a white round close-arrow (`bg-white rounded-[17px] size-6`, `Icon name="arrow"` rotated to point left, `aria-label={t('closeChat')}`, `onClick={togglePanel}`) + `<Text tag="h2" size="xl" weight="bold">` title; a 1px separator below the header; a bottom fade gradient above the input.

Audit §3 (chat panel) / §4 (room + chat open). Panel already toggles via `translate-x`; keep that.

- [ ] **Step 1: Add the `closeChat` i18n key (both locales)**

`en.ts` `chat`: `closeChat: 'Close chat',` · `ru.ts` `chat`: `closeChat: 'Закрыть чат',`.

- [ ] **Step 2: Update the failing test**

In `frontend/src/features/chat/ChatPanel.test.tsx`, assert the width, the close control, and the H2 title:
```tsx
    const panel = screen.getByRole('complementary'); // <aside>
    expect(panel).toHaveClass('w-[340px]', 'bg-surface-elevated');
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run src/features/chat/ChatPanel.test.tsx` → FAIL (`w-80`, no close button, header not a heading).

- [ ] **Step 4: Rebuild the panel**

Rewrite the return of `frontend/src/features/chat/ChatPanel.tsx` (add imports for `Text`, `Icon`; pull `togglePanel` from the store):
```tsx
  const togglePanel = useChatStore((s) => s.togglePanel);
  return (
    <aside
      aria-labelledby="chat-panel-title"
      className={clsx(
        'fixed right-0 top-0 z-20 flex h-full w-[340px] flex-col bg-surface-elevated transition-transform',
        isPanelOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-white/10 px-6 py-4">
        <button
          type="button"
          aria-label={t('closeChat')}
          onClick={togglePanel}
          className="grid size-6 place-items-center rounded-[17px] bg-white"
        >
          <Icon name="arrow" className="h-4 w-4 -rotate-90 text-surface" />
        </button>
        <Text tag="h2" id="chat-panel-title" size="xl" weight="bold" className="text-white">
          {t('title')}
        </Text>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <MessageList items={messages} selfIdentity={selfIdentity} />
        {/* Bottom fade over the last messages (Figma: 65px gradient above the input). */}
        <div className="pointer-events-none absolute inset-x-3 bottom-[64px] h-16 bg-gradient-to-b from-transparent to-surface-elevated" />
      </div>
      <ChatInput onSend={sendMessage} />
    </aside>
  );
```
Add `import clsx from 'clsx';`. (Reconcile the arrow rotation direction visually — the glyph must point left.)

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx vitest run src/features/chat/ChatPanel.test.tsx src/shared/i18n/i18n.test.ts` → PASS.

- [ ] **Step 6: Gates**

Run: `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/chat/ChatPanel.tsx frontend/src/features/chat/ChatPanel.test.tsx frontend/src/shared/i18n/en.ts frontend/src/shared/i18n/ru.ts
git commit -m "feat(frontend): rebuild ChatPanel to Figma (340px, close-arrow header, separator, fade)"
```

---

### Task 8: `ChatInput` Figma restyle (keep textarea; send-icon)

**Files:**
- Modify: `frontend/src/features/chat/components/ChatInput.tsx`
- Modify: `frontend/src/features/chat/components/ChatInput.test.tsx`

**Interfaces:**
- Consumes: `Icon` (Task 1). Props unchanged (`ChatInputProps` — plus whatever M5 added; **preserve M5's attachment staging row + paperclip control + validation exactly**).
- Produces: the input row restyled to Figma — outer wrapper without the `border-t` separator; the field container `bg-surface rounded-[11px] px-3 py-2` with a hover border `hover:border hover:border-white/25`; the **`<textarea>` is kept** (accepted multi-line deviation, decision-log item 9); the send `<Button>` text is replaced by a 34×34 icon button using `Icon name="send"` (blue), disabled when empty. Keep the char counter.

Audit §3 (chat field) + **decision-log item 9 (keep textarea)**.

- [ ] **Step 1: Update the failing test**

In `frontend/src/features/chat/components/ChatInput.test.tsx`, replace the "Send" text-button assertion with the icon send button, and assert the field container styling + that the textarea is retained:
```tsx
    expect(screen.getByRole('textbox')).toBeInTheDocument(); // textarea kept
    const send = screen.getByRole('button', { name: /send/i });
    expect(send.querySelector('svg')).not.toBeNull(); // icon, not text
```
> The send button needs an accessible name — add `aria-label={t('send')}` on it.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/features/chat/components/ChatInput.test.tsx` → FAIL (text `Button`, `border-t` wrapper).

- [ ] **Step 3: Restyle the input**

In `frontend/src/features/chat/components/ChatInput.tsx`, keep the state/`submit`/counter logic and the M5 attachment markup; replace the form wrapper + field + send button (do **not** switch away from `<textarea>`):
```tsx
    <form onSubmit={submit} className="flex flex-col gap-1 p-3">
      {/* PRESERVE M5: staged-attachment row + paperclip control render here, above the field. */}
      <div className="flex items-end gap-3 rounded-[11px] bg-surface px-3 py-2 hover:border hover:border-white/25">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
          placeholder={t('placeholder')}
          rows={2}
          className="flex-1 resize-none bg-transparent text-base font-light text-white outline-none placeholder:text-white/25"
        />
        <button
          type="submit"
          aria-label={t('send')}
          disabled={!canSend}
          className="shrink-0 disabled:opacity-40"
        >
          <Icon name="send" className="h-[34px] w-[34px] text-accent" />
        </button>
      </div>
      {text.length >= COUNTER_THRESHOLD && (
        <span className="self-end text-xs text-slate-500">{t('charCount', { length: text.length })}</span>
      )}
    </form>
```
Add `import { Icon } from '../../../shared/ui/Icon';`; drop the `Button` import if now unused.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/features/chat/components/ChatInput.test.tsx` → PASS.

- [ ] **Step 5: Gates + full suite**

Run (from `frontend/`):
```bash
npm run typecheck && npm run lint && npx vitest run
```
Expected: all PASS (including the M5 attachment tests — confirm none regressed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/chat/components/ChatInput.tsx frontend/src/features/chat/components/ChatInput.test.tsx
git commit -m "feat(frontend): restyle ChatInput to Figma (surface field, send-icon; textarea kept per decision 9)"
```

---

## Definition of done (M7b)

- The controls bar is the V2 round-icon layout: mic · camera · screen-share · end/leave (center) + Copy link · Chat (bottom-right), correct per-control colors and the chat dark→blue state.
- The video grid uses 16px gaps, per-count Figma widths, and 16:9 tiles; tiles have the 12px radius, glyph-based name pill, and camera-off content (no emoji).
- The chat panel is the 340px docked Figma panel (close-arrow header + H2 + separator + fade); messages have Figma sender colors, bubble radii, and inline timestamps; the input is the restyled surface field with a send-icon (textarea kept).
- **All M5 (attachments/lightbox) and M6 (screen share) behavior is intact** — their tests still pass.
- `npm run typecheck`, `npm run lint`, and `npx vitest run` all pass from `frontend/`.
- **Smoke the real stack** (rule `60-testing.md`): `docker compose up --build`, then eyeball a 2–4 participant call, the open chat panel, screen share, and an image attachment against the Figma V2 frames — green unit gates are not proof it looks right.

## Deferred / not in scope

- Screen-share **glyph sourcing + control wiring** depends on M6's final API — Task 2 slots the styled control; connect it to M6's real handler/state at execution.
- Tooltip **copy** reconciliation against the PRD (audit §3 note: Figma "Turn off camera" vs i18n "Turn camera off") is a verify step — change strings only if the PRD dictates; M7b does not alter copy on its own.
- Light-theme parity for these rebuilt surfaces follows the M1 `dark:` approach (audit §6.12) — verify each new hard-coded dark value has a light counterpart where the theme toggle applies.
