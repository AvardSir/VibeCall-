# M2 — Adaptive Video Grid + Camera-off / Mute Tiles + Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every participant (self + remotes) in an adaptive 1/2/3/4 video grid with camera-off and mute indicators, and add state-aware tooltips to the in-call controls.

**Architecture:** Frontend-only (no backend change — guest tokens already grant `canSubscribe`, media flows participant ↔ LiveKit SFU). A `useParticipants` hook wraps LiveKit room/track events and mirrors the ordered participant roster into a new `useParticipantsStore`. A `VideoGrid` reads that roster, picks the layout by count, and renders a presentational `VideoTile` per participant (looking up each one's live camera track via `useTracks`). Remote audio already plays through the existing `RoomAudioRenderer`. Tooltips are native `title` attributes driven by control state.

**Tech Stack:** React 19 + TypeScript, `@livekit/components-react` 2.9 / `livekit-client` 2.20, Zustand 5, react-i18next, Tailwind v4, Vitest 4 + Testing Library.

## Global Constraints

- **PRD is binding** (`prd-kmb-video-chat.md` v2.0); Figma is an outdated visual reference. On conflict, PRD wins.
- **No `any`**, no inline `// eslint-disable`, no `// @ts-ignore`, no `console.log`. `tsc -b` and `eslint .` must stay clean (zero warnings).
- **No hardcoded user-facing strings** — every label/notice/tooltip goes through `t()`, namespace `call`, with **parallel EN + RU** keys (`ru.ts` derives its type from `en.ts`, so any new `en.call` key must also be added to `ru.call` or the build fails).
- **Types** `PascalCase`, no `I`-prefix; string-literal unions over `enum`; `import type` for type-only imports; **named exports only**; explicit return types on exported functions.
- **One Zustand store per concern**; actions live in the store; components subscribe to the **narrowest** slice; the store holds **UI mirror state only** (no live LiveKit objects, no business rules).
- **Feature-based layout**: new code lives under `frontend/src/features/call/`; stores under `frontend/src/stores/`; cross-cutting types in `frontend/src/shared/types/`. A feature imports `shared`/`stores`, never another feature's internals.
- **Co-located tests** (`*.test.ts[x]` next to source); test behavior via visible output; mock LiveKit (no real SFU). Components stay presentational; side effects live in hooks.
- **Desktop only** (≥1024px) — no sub-1024px breakpoints required.
- **Verbatim strings:** solo notice = `Waiting for someone to join…`; own-tile label = `<name> (You)`; tooltips per FR-20 (exact texts in Task 6).

### Out of scope for M2 (do not build here)

- Screen share + thumbnail-strip layout (M6); `activeSharerId` exists in the store shape but stays `null`.
- Host "Remove guest" affordance / tooltip (M4); screen-share & end-call tooltips (M6/M4).
- Disabling camera/mic toggles when permission was denied at pre-join (FR-12 / US-6·US-7 AC-3) — a separate media-permission concern, not part of this milestone's deliverable.
- Active-speaker highlighting (not in product scope).

---

## File structure

| File | Responsibility | Action |
| --- | --- | --- |
| `frontend/src/shared/types/index.ts` | Add `CallParticipant` cross-cutting type | Modify |
| `frontend/src/stores/useParticipantsStore.ts` | Roster mirror store (`participants`, `activeSharerId`) | Create |
| `frontend/src/stores/useParticipantsStore.test.ts` | Store action tests | Create |
| `frontend/src/features/call/hooks/useParticipants.ts` | LiveKit room/track events → ordered roster → store | Create |
| `frontend/src/features/call/hooks/useParticipants.test.ts` | Hook behavior tests | Create |
| `frontend/src/features/call/components/VideoTile.tsx` | Presentational single-participant tile | Create |
| `frontend/src/features/call/components/VideoTile.test.tsx` | Tile rendering tests | Create |
| `frontend/src/features/call/components/VideoGrid.tsx` | Layout-by-count container; mounts the hook | Create |
| `frontend/src/features/call/components/VideoGrid.test.tsx` | Layout selection + notice tests | Create |
| `frontend/src/features/call/components/OwnTile.tsx` | Superseded by `VideoTile` | Delete |
| `frontend/src/features/call/CallShell.tsx` | Render `VideoGrid` instead of `OwnTile`; drop `displayName` prop | Modify |
| `frontend/src/App.tsx` | Drop `displayName` prop; reset participants store on leave | Modify |
| `frontend/src/shared/ui/Toggle.tsx` | Optional `tooltip` prop (native `title`) | Modify |
| `frontend/src/shared/ui/Button.tsx` | Optional `title` prop | Modify |
| `frontend/src/features/call/components/ControlsBar.tsx` | Pass state-aware tooltips to controls | Modify |
| `frontend/src/features/call/components/ControlsBar.test.tsx` | Assert tooltip texts | Modify |
| `frontend/src/shared/i18n/en.ts` + `ru.ts` | `waiting` + tooltip keys (EN/RU) | Modify |

---

## Task 1: `useParticipantsStore` + `CallParticipant` type

**Files:**
- Modify: `frontend/src/shared/types/index.ts`
- Create: `frontend/src/stores/useParticipantsStore.ts`
- Test: `frontend/src/stores/useParticipantsStore.test.ts`

**Interfaces:**
- Produces: `type CallParticipant = { identity: string; name: string; isLocal: boolean; isCameraEnabled: boolean; isMicrophoneEnabled: boolean }` (in `shared/types`).
- Produces: `useParticipantsStore` with state `{ participants: CallParticipant[]; activeSharerId: string | null; setParticipants(p: CallParticipant[]): void; reset(): void }`.

- [ ] **Step 1: Add the `CallParticipant` type**

Append to `frontend/src/shared/types/index.ts`:

```ts
export type CallParticipant = {
  identity: string;
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
};
```

- [ ] **Step 2: Write the failing store test**

Create `frontend/src/stores/useParticipantsStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useParticipantsStore } from './useParticipantsStore';
import type { CallParticipant } from '../shared/types';

const sample: CallParticipant = {
  identity: 'p_1',
  name: 'Ann',
  isLocal: true,
  isCameraEnabled: true,
  isMicrophoneEnabled: true,
};

beforeEach(() => {
  useParticipantsStore.getState().reset();
});

describe('useParticipantsStore', () => {
  it('starts empty with no active sharer', () => {
    const state = useParticipantsStore.getState();
    expect(state.participants).toEqual([]);
    expect(state.activeSharerId).toBeNull();
  });

  it('setParticipants replaces the roster', () => {
    useParticipantsStore.getState().setParticipants([sample]);
    expect(useParticipantsStore.getState().participants).toEqual([sample]);
  });

  it('reset clears the roster and active sharer', () => {
    useParticipantsStore.getState().setParticipants([sample]);
    useParticipantsStore.getState().reset();
    expect(useParticipantsStore.getState().participants).toEqual([]);
    expect(useParticipantsStore.getState().activeSharerId).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/stores/useParticipantsStore.test.ts`
Expected: FAIL — cannot resolve `./useParticipantsStore`.

- [ ] **Step 4: Create the store**

Create `frontend/src/stores/useParticipantsStore.ts`:

```ts
import { create } from 'zustand';
import type { CallParticipant } from '../shared/types';

type ParticipantsState = {
  participants: CallParticipant[];
  // Forward-compat for screen share (M6); always null in M2.
  activeSharerId: string | null;
  setParticipants: (participants: CallParticipant[]) => void;
  reset: () => void;
};

export const useParticipantsStore = create<ParticipantsState>()((set) => ({
  participants: [],
  activeSharerId: null,
  setParticipants: (participants) => set({ participants }),
  reset: () => set({ participants: [], activeSharerId: null }),
}));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/stores/useParticipantsStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/types/index.ts frontend/src/stores/useParticipantsStore.ts frontend/src/stores/useParticipantsStore.test.ts
git commit -m "feat(frontend): add useParticipantsStore + CallParticipant type"
```

---

## Task 2: `useParticipants` hook (LiveKit roster mirroring)

**Files:**
- Create: `frontend/src/features/call/hooks/useParticipants.ts`
- Test: `frontend/src/features/call/hooks/useParticipants.test.ts`

**Interfaces:**
- Consumes: `useRoomContext` from `@livekit/components-react`; `useParticipantsStore.setParticipants` (Task 1); `CallParticipant` (Task 1).
- Produces: `useParticipants(): void` — subscribes to room events and writes the ordered roster (self + remotes, sorted by `joinedAt` ascending) into the store. All LiveKit side effects live here; returns nothing.

- [ ] **Step 1: Write the failing hook test**

Create `frontend/src/features/call/hooks/useParticipants.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';

type FakeParticipant = {
  identity: string;
  name: string;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  joinedAt: Date;
};

function makeParticipant(
  identity: string,
  name: string,
  cam: boolean,
  mic: boolean,
  joinedAtMs: number,
): FakeParticipant {
  return { identity, name, isCameraEnabled: cam, isMicrophoneEnabled: mic, joinedAt: new Date(joinedAtMs) };
}

function makeRoom() {
  const handlers = new Set<() => void>();
  const localParticipant = makeParticipant('local', 'Me', true, true, 1000);
  const remoteParticipants = new Map<string, FakeParticipant>();
  return {
    localParticipant,
    remoteParticipants,
    on(_event: string, handler: () => void) {
      handlers.add(handler);
      return this;
    },
    off(_event: string, handler: () => void) {
      handlers.delete(handler);
      return this;
    },
    emit() {
      handlers.forEach((handler) => handler());
    },
  };
}

const room = makeRoom();
vi.mock('@livekit/components-react', () => ({
  useRoomContext: () => room,
}));

import { useParticipants } from './useParticipants';

beforeEach(() => {
  useParticipantsStore.getState().reset();
  room.remoteParticipants.clear();
  room.localParticipant.isCameraEnabled = true;
  room.localParticipant.isMicrophoneEnabled = true;
});

describe('useParticipants', () => {
  it('seeds the store with the local participant on mount', () => {
    renderHook(() => useParticipants());
    const { participants } = useParticipantsStore.getState();
    expect(participants).toHaveLength(1);
    expect(participants[0]).toMatchObject({ identity: 'local', name: 'Me', isLocal: true });
  });

  it('adds a remote participant when one connects (ordered by joinedAt, local first)', () => {
    renderHook(() => useParticipants());
    room.remoteParticipants.set('r1', makeParticipant('r1', 'Bob', true, true, 2000));
    room.emit();
    const { participants } = useParticipantsStore.getState();
    expect(participants.map((p) => p.identity)).toEqual(['local', 'r1']);
    expect(participants[1]).toMatchObject({ isLocal: false, name: 'Bob' });
  });

  it('reflects a camera/mic toggle on the next event', () => {
    renderHook(() => useParticipants());
    room.localParticipant.isCameraEnabled = false;
    room.localParticipant.isMicrophoneEnabled = false;
    room.emit();
    const local = useParticipantsStore.getState().participants[0];
    expect(local.isCameraEnabled).toBe(false);
    expect(local.isMicrophoneEnabled).toBe(false);
  });

  it('removes a participant when they disconnect', () => {
    renderHook(() => useParticipants());
    room.remoteParticipants.set('r1', makeParticipant('r1', 'Bob', true, true, 2000));
    room.emit();
    room.remoteParticipants.delete('r1');
    room.emit();
    expect(useParticipantsStore.getState().participants.map((p) => p.identity)).toEqual(['local']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/call/hooks/useParticipants.test.ts`
Expected: FAIL — cannot resolve `./useParticipants`.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/features/call/hooks/useParticipants.ts`:

```ts
import { useEffect } from 'react';
import { RoomEvent } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import type { CallParticipant } from '../../../shared/types';

const SYNC_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
] as const;

function toCallParticipant(participant: Participant, isLocal: boolean): CallParticipant {
  return {
    identity: participant.identity,
    // Token mints `name: displayName` (backend livekitTokens.ts); fall back to identity.
    name: participant.name || participant.identity,
    isLocal,
    isCameraEnabled: participant.isCameraEnabled,
    isMicrophoneEnabled: participant.isMicrophoneEnabled,
  };
}

export function useParticipants(): void {
  const room = useRoomContext();
  const setParticipants = useParticipantsStore((s) => s.setParticipants);

  useEffect(() => {
    function sync(): void {
      const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
      const ordered = [...all].sort(
        (a, b) => (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0),
      );
      setParticipants(ordered.map((p) => toCallParticipant(p, p === room.localParticipant)));
    }

    sync();
    SYNC_EVENTS.forEach((event) => room.on(event, sync));
    return () => {
      SYNC_EVENTS.forEach((event) => room.off(event, sync));
    };
  }, [room, setParticipants]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/call/hooks/useParticipants.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/call/hooks/useParticipants.ts frontend/src/features/call/hooks/useParticipants.test.ts
git commit -m "feat(frontend): add useParticipants hook mirroring LiveKit roster to store"
```

---

## Task 3: `VideoTile` presentational component

**Files:**
- Create: `frontend/src/features/call/components/VideoTile.tsx`
- Test: `frontend/src/features/call/components/VideoTile.test.tsx`

**Interfaces:**
- Consumes: `VideoTrack` + `TrackReference` from `@livekit/components-react`; `t('you', { name })` (existing `call` key).
- Produces: `VideoTile(props: VideoTileProps): JSX.Element` where `VideoTileProps = { name: string; isLocal: boolean; isCameraEnabled: boolean; isMicrophoneEnabled: boolean; cameraTrackRef: TrackReference | undefined }`.

Behavior (FR-13/FR-14): camera on + track present → video, `object-cover`, mirrored only when local; mic off adds a corner mute icon (`data-testid="corner-mute"`); name label bottom-left. Camera off → dark tile, mic-state icon centered (`data-testid="center-mic"`) with the name centered beneath it (no avatar). Label is `<name> (You)` for local, plain `<name>` for remotes.

- [ ] **Step 1: Write the failing tile test**

Create `frontend/src/features/call/components/VideoTile.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import type { TrackReference } from '@livekit/components-react';

vi.mock('@livekit/components-react', () => ({
  VideoTrack: ({ className }: { className: string }) => (
    <div data-testid="video-track" className={className} />
  ),
}));

import { VideoTile } from './VideoTile';

// A camera track is identified only by presence in these tests; the mocked
// VideoTrack ignores its content, so an empty object cast is sufficient.
const fakeTrack = {} as TrackReference;

describe('VideoTile', () => {
  it('renders mirrored video with the "(You)" label for the local participant', () => {
    render(
      <VideoTile name="Ann" isLocal isCameraEnabled isMicrophoneEnabled cameraTrackRef={fakeTrack} />,
    );
    expect(screen.getByText('Ann (You)')).toBeInTheDocument();
    expect(screen.getByTestId('video-track').className).toContain('-scale-x-100');
    expect(screen.getByTestId('video-track').className).toContain('object-cover');
  });

  it('does not mirror remote video and uses a plain name label', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled cameraTrackRef={fakeTrack} />,
    );
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByTestId('video-track').className).not.toContain('-scale-x-100');
  });

  it('shows the centered mic-state icon + name (no video) when the camera is off', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled={false} isMicrophoneEnabled cameraTrackRef={undefined} />,
    );
    expect(screen.queryByTestId('video-track')).not.toBeInTheDocument();
    expect(screen.getByTestId('center-mic')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows a corner mute icon when the camera is on and the mic is off', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled isMicrophoneEnabled={false} cameraTrackRef={fakeTrack} />,
    );
    expect(screen.getByTestId('video-track')).toBeInTheDocument();
    expect(screen.getByTestId('corner-mute')).toBeInTheDocument();
  });

  it('does not show a corner mute icon when the camera is off (uses the centered icon instead)', () => {
    render(
      <VideoTile name="Bob" isLocal={false} isCameraEnabled={false} isMicrophoneEnabled={false} cameraTrackRef={undefined} />,
    );
    expect(screen.queryByTestId('corner-mute')).not.toBeInTheDocument();
    expect(screen.getByTestId('center-mic')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/call/components/VideoTile.test.tsx`
Expected: FAIL — cannot resolve `./VideoTile`.

- [ ] **Step 3: Implement the component**

Create `frontend/src/features/call/components/VideoTile.tsx`:

```tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { VideoTrack } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';

export type VideoTileProps = {
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  cameraTrackRef: TrackReference | undefined;
};

export function VideoTile({
  name,
  isLocal,
  isCameraEnabled,
  isMicrophoneEnabled,
  cameraTrackRef,
}: VideoTileProps): JSX.Element {
  const { t } = useTranslation('call');
  const label = isLocal ? t('you', { name }) : name;
  const showVideo = isCameraEnabled && cameraTrackRef != null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
      {showVideo ? (
        <>
          <VideoTrack
            trackRef={cameraTrackRef}
            className={`h-full w-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
          />
          {!isMicrophoneEnabled && (
            <span
              data-testid="corner-mute"
              aria-hidden
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm text-white"
            >
              🔇
            </span>
          )}
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
            {label}
          </span>
        </>
      ) : (
        // Camera off: mic-state icon centered above the name on a dark background — no avatar (FR-14).
        <div className="grid h-full place-items-center">
          <div className="flex flex-col items-center gap-2">
            <span data-testid="center-mic" aria-hidden className="text-4xl text-slate-400">
              {isMicrophoneEnabled ? '🎤' : '🔇'}
            </span>
            <span className="text-sm text-white">{label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/call/components/VideoTile.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/call/components/VideoTile.tsx frontend/src/features/call/components/VideoTile.test.tsx
git commit -m "feat(frontend): add presentational VideoTile (camera-off + mute indicators)"
```

---

## Task 4: `VideoGrid` container (layout by count + solo notice)

**Files:**
- Create: `frontend/src/features/call/components/VideoGrid.tsx`
- Test: `frontend/src/features/call/components/VideoGrid.test.tsx`
- Modify: `frontend/src/shared/i18n/en.ts`, `frontend/src/shared/i18n/ru.ts` (add `call.waiting`)

**Interfaces:**
- Consumes: `useParticipants()` (Task 2, side-effect only); `useParticipantsStore((s) => s.participants)` (Task 1); `useTracks([Track.Source.Camera])` from `@livekit/components-react`; `VideoTile` (Task 3); `t('waiting')`.
- Produces: `VideoGrid(): JSX.Element` — mounts the roster hook, builds an identity→`TrackReference` map, renders one `VideoTile` per participant in roster order, picks the grid layout from the count, and shows the "Waiting…" notice only at count 1. Container carries `data-testid="video-grid"` and `data-count={count}`.

- [ ] **Step 1: Add the `waiting` string to EN and RU**

In `frontend/src/shared/i18n/en.ts`, update the `call` block:

```ts
  call: {
    you: '{{name}} (You)',
    leave: 'Leave',
    micToggle: 'Microphone',
    cameraToggle: 'Camera',
    waiting: 'Waiting for someone to join…',
  },
```

In `frontend/src/shared/i18n/ru.ts`, update the `call` block to keep key parity:

```ts
  call: {
    you: '{{name}} (Вы)',
    leave: 'Выйти',
    micToggle: 'Микрофон',
    cameraToggle: 'Камера',
    waiting: 'Ожидаем, пока кто-нибудь присоединится…',
  },
```

- [ ] **Step 2: Write the failing grid test**

Create `frontend/src/features/call/components/VideoGrid.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import type { CallParticipant } from '../../../shared/types';

// The grid is what we test; the roster hook and LiveKit track subscription are
// stubbed so we drive the store directly.
vi.mock('../hooks/useParticipants', () => ({ useParticipants: () => undefined }));
vi.mock('@livekit/components-react', () => ({ useTracks: () => [] }));
vi.mock('./VideoTile', () => ({
  VideoTile: ({ name }: { name: string }) => <div data-testid="video-tile">{name}</div>,
}));

import { VideoGrid } from './VideoGrid';

function roster(count: number): CallParticipant[] {
  return Array.from({ length: count }, (_, i) => ({
    identity: `p_${i}`,
    name: `User ${i}`,
    isLocal: i === 0,
    isCameraEnabled: true,
    isMicrophoneEnabled: true,
  }));
}

beforeEach(() => {
  useParticipantsStore.getState().reset();
});

describe('VideoGrid', () => {
  it('renders the solo state with the "Waiting…" notice for one participant', () => {
    useParticipantsStore.getState().setParticipants(roster(1));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(1);
    expect(screen.getByText('Waiting for someone to join…')).toBeInTheDocument();
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '1');
  });

  it('renders two tiles and no notice for two participants', () => {
    useParticipantsStore.getState().setParticipants(roster(2));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(2);
    expect(screen.queryByText('Waiting for someone to join…')).not.toBeInTheDocument();
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '2');
  });

  it('renders three tiles for three participants', () => {
    useParticipantsStore.getState().setParticipants(roster(3));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(3);
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '3');
  });

  it('renders four tiles for four participants', () => {
    useParticipantsStore.getState().setParticipants(roster(4));
    render(<VideoGrid />);
    expect(screen.getAllByTestId('video-tile')).toHaveLength(4);
    expect(screen.getByTestId('video-grid')).toHaveAttribute('data-count', '4');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/call/components/VideoGrid.test.tsx`
Expected: FAIL — cannot resolve `./VideoGrid`.

- [ ] **Step 4: Implement the component**

Create `frontend/src/features/call/components/VideoGrid.tsx`:

```tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-react';
import { useParticipants } from '../hooks/useParticipants';
import { useParticipantsStore } from '../../../stores/useParticipantsStore';
import { VideoTile } from './VideoTile';

// Layout per FR-13: 1 → full; 2 → left/right; 3 → two top + one centered bottom;
// 4 → 2×2. The 3-up case uses a 2×2 grid where the third tile spans and centers.
const GRID_LAYOUT: Record<number, string> = {
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-1',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
};

export function VideoGrid(): JSX.Element {
  const { t } = useTranslation('call');
  useParticipants();
  const participants = useParticipantsStore((s) => s.participants);
  const cameraTracks = useTracks([Track.Source.Camera]);

  const trackByIdentity = new Map<string, TrackReference>(
    cameraTracks.map((ref) => [ref.participant.identity, ref]),
  );

  const count = participants.length;
  const layout = GRID_LAYOUT[count] ?? 'grid-cols-2 grid-rows-2';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-6">
      <div data-testid="video-grid" data-count={count} className={`grid h-full w-full max-w-5xl gap-3 ${layout}`}>
        {participants.map((p, index) => {
          const centerBottom =
            count === 3 && index === 2 ? 'col-span-2 w-1/2 justify-self-center' : '';
          return (
            <div key={p.identity} className={`min-h-0 ${centerBottom}`}>
              <VideoTile
                name={p.name}
                isLocal={p.isLocal}
                isCameraEnabled={p.isCameraEnabled}
                isMicrophoneEnabled={p.isMicrophoneEnabled}
                cameraTrackRef={trackByIdentity.get(p.identity)}
              />
            </div>
          );
        })}
      </div>
      {count === 1 && (
        <p className="absolute bottom-24 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {t('waiting')}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/call/components/VideoGrid.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify i18n key parity stays green**

Run: `cd frontend && npx vitest run src/shared/i18n/i18n.test.ts`
Expected: PASS (EN/RU keys still in parity).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/call/components/VideoGrid.tsx frontend/src/features/call/components/VideoGrid.test.tsx frontend/src/shared/i18n/en.ts frontend/src/shared/i18n/ru.ts
git commit -m "feat(frontend): add adaptive VideoGrid (1/2/3/4 layouts + solo notice)"
```

---

## Task 5: Wire `VideoGrid` into `CallShell`; retire `OwnTile`; reset roster on leave

**Files:**
- Modify: `frontend/src/features/call/CallShell.tsx`
- Delete: `frontend/src/features/call/components/OwnTile.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `VideoGrid` (Task 4); `useParticipantsStore.reset` (Task 1).
- Produces: `CallShellProps` no longer has `displayName` (the grid derives names from LiveKit). `RoomAudioRenderer` stays mounted so remote audio plays (FR-15) and local audio is excluded (no echo).

- [ ] **Step 1: Replace the single tile with the grid in `CallShell`**

In `frontend/src/features/call/CallShell.tsx`:

Replace the import line
```ts
import { OwnTile } from './components/OwnTile';
```
with
```ts
import { VideoGrid } from './components/VideoGrid';
```

Remove `displayName` from the props type and destructuring:
```ts
export type CallShellProps = {
  accessToken: string;
  serverUrl: string;
  onLeave: () => void;
  onConnectError: () => void;
  onRoomFull: () => void;
};

export function CallShell({
  accessToken,
  serverUrl,
  onLeave,
  onConnectError,
  onRoomFull,
}: CallShellProps): JSX.Element {
```

Replace the in-call body block
```tsx
      <div className="flex flex-1 items-center justify-center p-6">
        {/* Subtask 3 replaces this single tile with the 2x2 remote grid. */}
        <div className="w-full max-w-2xl">
          <OwnTile displayName={displayName} />
        </div>
      </div>
```
with
```tsx
      <div className="flex flex-1 items-center justify-center">
        <VideoGrid />
      </div>
```

(Leave `<RoomAudioRenderer />` and `<ControlsBar onLeave={onLeave} />` unchanged.)

- [ ] **Step 2: Delete the superseded `OwnTile`**

```bash
git rm frontend/src/features/call/components/OwnTile.tsx
```

- [ ] **Step 3: Update `App.tsx` — drop `displayName`, reset roster on leave**

In `frontend/src/App.tsx`:

Add the store import after the other store imports:
```ts
import { useParticipantsStore } from './stores/useParticipantsStore';
```

Add the reset selector alongside the existing reset selectors:
```ts
  const resetParticipants = useParticipantsStore((s) => s.reset);
```

Call it in `leave()`:
```ts
  function leave(): void {
    setSession(null);
    resetConnection();
    resetMedia();
    resetChat();
    resetParticipants();
    recheckCapacity();
  }
```

Remove the `displayName` prop from the `CallShell` usage:
```tsx
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          onLeave={leave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
        />
```

- [ ] **Step 4: Run the affected suites + typecheck**

Run: `cd frontend && npx vitest run src/App.test.tsx && npx tsc -b`
Expected: PASS — `App.test.tsx` mocks `./features/call` so it is unaffected by the prop change; `tsc -b` is clean (no unused `displayName`, no dangling `OwnTile` import).

- [ ] **Step 5: Run the full frontend suite + lint**

Run: `cd frontend && npm run test && npm run lint`
Expected: PASS — no remaining references to `OwnTile`; lint clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/call/CallShell.tsx frontend/src/App.tsx
git commit -m "feat(frontend): render VideoGrid in CallShell; retire OwnTile; reset roster on leave"
```

---

## Task 6: State-aware control tooltips (FR-20)

**Files:**
- Modify: `frontend/src/shared/ui/Toggle.tsx`
- Modify: `frontend/src/shared/ui/Button.tsx`
- Modify: `frontend/src/features/call/components/ControlsBar.tsx`
- Modify: `frontend/src/features/call/components/ControlsBar.test.tsx`
- Modify: `frontend/src/shared/i18n/en.ts`, `frontend/src/shared/i18n/ru.ts`

**Interfaces:**
- Produces: `ToggleProps` gains optional `tooltip?: string` (rendered as the native `title` attribute). `ButtonProps` gains optional `title?: string`.
- Consumes: new `call` keys `cameraTooltipOn`/`cameraTooltipOff`/`micTooltipOn`/`micTooltipOff`/`leaveTooltip`.

Tooltip texts (FR-20, verbatim): camera on → "Turn camera off"; camera off → "Turn camera on"; mic on → "Mute microphone"; mic off → "Unmute microphone"; guest leave → "Leave the call". (Screen-share, end-call, and remove-guest tooltips land with M6/M4 when those controls exist.)

- [ ] **Step 1: Add the tooltip strings to EN and RU**

In `frontend/src/shared/i18n/en.ts`, the `call` block becomes:

```ts
  call: {
    you: '{{name}} (You)',
    leave: 'Leave',
    micToggle: 'Microphone',
    cameraToggle: 'Camera',
    waiting: 'Waiting for someone to join…',
    cameraTooltipOn: 'Turn camera off',
    cameraTooltipOff: 'Turn camera on',
    micTooltipOn: 'Mute microphone',
    micTooltipOff: 'Unmute microphone',
    leaveTooltip: 'Leave the call',
  },
```

In `frontend/src/shared/i18n/ru.ts`, keep parity:

```ts
  call: {
    you: '{{name}} (Вы)',
    leave: 'Выйти',
    micToggle: 'Микрофон',
    cameraToggle: 'Камера',
    waiting: 'Ожидаем, пока кто-нибудь присоединится…',
    cameraTooltipOn: 'Выключить камеру',
    cameraTooltipOff: 'Включить камеру',
    micTooltipOn: 'Выключить микрофон',
    micTooltipOff: 'Включить микрофон',
    leaveTooltip: 'Покинуть звонок',
  },
```

- [ ] **Step 2: Add a `tooltip` prop to `Toggle`**

In `frontend/src/shared/ui/Toggle.tsx`:

```tsx
import type { JSX } from 'react';

export type ToggleProps = {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  tooltip?: string;
  onChange: (pressed: boolean) => void;
};

export function Toggle({ label, pressed, disabled, tooltip, onChange }: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      title={tooltip}
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

- [ ] **Step 3: Add a `title` prop to `Button`**

In `frontend/src/shared/ui/Button.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { JSX } from 'react';

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
  title?: string;
};

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button', title }: ButtonProps): JSX.Element {
  const base = 'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent/90',
    ghost: 'bg-transparent text-slate-200 hover:bg-surface-muted',
  } as const;
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Write the failing tooltip assertions in `ControlsBar.test.tsx`**

Append these tests inside the `describe('ControlsBar', …)` block in `frontend/src/features/call/components/ControlsBar.test.tsx`:

```tsx
  it('shows state-aware tooltips on the camera and mic toggles', () => {
    render(<ControlsBar onLeave={vi.fn()} />);
    // Defaults: mic on, camera on → tooltips offer the "turn off / mute" action.
    expect(screen.getByRole('switch', { name: 'Camera' })).toHaveAttribute('title', 'Turn camera off');
    expect(screen.getByRole('switch', { name: 'Microphone' })).toHaveAttribute('title', 'Mute microphone');
    // Toggle the mic off → tooltip flips to the "unmute" action.
    fireEvent.click(screen.getByRole('switch', { name: 'Microphone' }));
    expect(screen.getByRole('switch', { name: 'Microphone' })).toHaveAttribute('title', 'Unmute microphone');
  });

  it('shows a tooltip on the Leave button', () => {
    render(<ControlsBar onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Leave' })).toHaveAttribute('title', 'Leave the call');
  });
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/call/components/ControlsBar.test.tsx`
Expected: FAIL — toggles/Leave have no `title` yet.

- [ ] **Step 6: Wire tooltips through `ControlsBar`**

In `frontend/src/features/call/components/ControlsBar.tsx`, update the camera/mic `Toggle`s and the Leave `Button` to pass state-aware tooltips (leave the chat button and effects unchanged):

```tsx
      <Toggle
        label={t('micToggle')}
        pressed={isMicOn}
        tooltip={isMicOn ? t('micTooltipOn') : t('micTooltipOff')}
        onChange={setMicOn}
      />
      <Toggle
        label={t('cameraToggle')}
        pressed={isCamOn}
        tooltip={isCamOn ? t('cameraTooltipOn') : t('cameraTooltipOff')}
        onChange={setCamOn}
      />
```

and the Leave button:

```tsx
      <Button variant="ghost" title={t('leaveTooltip')} onClick={onLeave}>
        {t('leave')}
      </Button>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/call/components/ControlsBar.test.tsx`
Expected: PASS (original 2 tests + 2 new tooltip tests).

- [ ] **Step 8: Full suite, typecheck, lint**

Run: `cd frontend && npm run test && npm run typecheck && npm run lint`
Expected: PASS — all suites green; `tsc -b` clean; ESLint zero warnings; i18n parity test green.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/shared/ui/Toggle.tsx frontend/src/shared/ui/Button.tsx frontend/src/features/call/components/ControlsBar.tsx frontend/src/features/call/components/ControlsBar.test.tsx frontend/src/shared/i18n/en.ts frontend/src/shared/i18n/ru.ts
git commit -m "feat(frontend): add state-aware control tooltips (FR-20)"
```

---

## Self-review

**Spec coverage:**

| Requirement | Task |
| --- | --- |
| FR-13 — one tile per participant; 1/2/3/4 layouts; local mirrored + `(You)`; cover fit; name label always | Tasks 3, 4 |
| FR-14 — camera off → centered mic-state icon above name (no avatar), tile keeps size; camera on + mic off → corner mute icon | Task 3 |
| FR-15 — remote audio plays through default output; no local echo | Task 5 (existing `RoomAudioRenderer` retained + verified) |
| FR-20 — state-aware tooltips on camera/mic/leave (controls that exist in M2) | Task 6 |
| US-5 — see/hear everyone; adaptive grid; camera-off & mute representations | Tasks 2, 3, 4, 5 |
| US-6 / US-7 — toggling camera/mic flips own tile + everyone's view live | Tasks 2, 3 (roster re-syncs on track mute/unmute events) |
| Spec §4.3 "Waiting for someone to join…" solo notice | Task 4 |
| Roster ordered (join order; host-first forward-compatible) | Task 2 (sort by `joinedAt`) |
| `useParticipantsStore` with `activeSharerId` forward-compat | Task 1 |
| Store reset when leaving the room | Task 5 |

**Deferred (explicitly out of scope, noted in Global Constraints):** screen share (M6), host remove-guest (M4), disabled-on-denied toggles (FR-12 follow-up), active-speaker UI.

**Placeholder scan:** none — every code step contains complete code; every command has expected output.

**Type consistency:** `CallParticipant` (Task 1) is used identically by `useParticipants` (Task 2), `VideoGrid` (Task 4); `setParticipants`/`reset` names match across Tasks 1/2/5; `VideoTileProps` fields (`cameraTrackRef: TrackReference | undefined`) match what `VideoGrid` passes (Task 4); `ToggleProps.tooltip` / `ButtonProps.title` match the `ControlsBar` usage (Task 6).
