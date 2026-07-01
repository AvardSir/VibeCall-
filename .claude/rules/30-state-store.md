# State Management (Zustand)

Client UI state lives in **Zustand** stores. **One store per concern** — keep them small.

> **Why "per concern", not "per domain".** Zustand exists to avoid one monolithic store; a store
> named after a broad domain (`useCallStore`) is an open invitation to accumulate every loosely
> "call-related" field until it is a god store in all but name. **Name a store after the single
> thing it owns.** If a name is broad enough that you can't predict what it will *not* hold, it's
> too broad — split it. The litmus test: a new field must have an obvious home, or it means a store
> is missing.

## Stores

```
stores/
  useMediaStore.ts         # local mic/cam on-off + device-permission state (self only)
  useConnectionStore.ts    # connection phase (idle|connecting|connected|failed) + local participant
  useParticipantsStore.ts  # participant list + active sharer (populated from Subtask 3)
  useChatStore.ts          # messages, unread count, staged attachments, panel open/closed
  useUiStore.ts            # theme (dark/light), language (en/ru)
```

There is deliberately **no `useCallStore`** — "the call" is not one concern. Self-media, connection
lifecycle, and the roster of participants are three concerns with three owners above.

## Conventions

- File and hook both named `useThingStore`. Export the typed hook only.
- Define the state shape as a `type` (PascalCase, no `I`-prefix), then create the store:

```ts
type MediaState = {
  isMicOn: boolean;
  isCamOn: boolean;
  // actions live on the same object, named as verbs
  setMicOn: (on: boolean) => void;
  setCamOn: (on: boolean) => void;
  reset: () => void;
};

export const useMediaStore = create<MediaState>()((set) => ({
  isMicOn: true,
  isCamOn: true,
  setMicOn: (on) => set({ isMicOn: on }),
  setCamOn: (on) => set({ isCamOn: on }),
  reset: () => set({ isMicOn: true, isCamOn: true }),
}));
```

- **Actions live inside the store** (named as verbs: `setX`, `addMessage`, `reset`). Components
  never mutate state directly.
- **Selector subscriptions:** components subscribe to the slice they use
  (`useParticipantsStore((s) => s.participants)`), not the whole store.
- **No server-authoritative data treated as truth in the store.** Room/role/lifecycle truth comes
  from the backend; the store mirrors it for rendering and is reconciled on server events.
- The store holds UI state only — **no business rules** (limits, validation, role checks). Those
  belong to the backend / domain layer.
- **Live connections are not UI state — keep them out of Zustand.** A Socket.IO socket (or any
  long-lived client/connection) belongs in a React context provider, not a store (see
  `20-frontend-structure.md` → "Shared clients"). The store mirrors *data* derived from it (messages,
  unread count), never the socket itself.
- Reset the relevant stores when leaving a room / room ends.
