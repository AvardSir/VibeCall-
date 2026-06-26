# State Management (Zustand)

Client UI state lives in **Zustand** stores. One store per domain; keep them small.

## Stores

```
stores/
  useCallStore.ts   # participants, local mic/cam/share state, active sharer, grace countdown
  useChatStore.ts   # messages, unread count, staged attachments, panel open/closed
  useUiStore.ts     # theme (dark/light), language (en/ru)
```

## Conventions

- File and hook both named `useThingStore`. Export the typed hook only.
- Define the state shape as a `type` (PascalCase, no `I`-prefix), then create the store:

```ts
type CallState = {
  participants: Participant[];
  isMicOn: boolean;
  isCamOn: boolean;
  activeSharerId: string | null;
  // actions live on the same object, named as verbs
  setMicOn: (on: boolean) => void;
  reset: () => void;
};

export const useCallStore = create<CallState>()((set) => ({
  participants: [],
  isMicOn: true,
  isCamOn: true,
  activeSharerId: null,
  setMicOn: (on) => set({ isMicOn: on }),
  reset: () => set({ participants: [], activeSharerId: null }),
}));
```

- **Actions live inside the store** (named as verbs: `setX`, `addMessage`, `reset`). Components
  never mutate state directly.
- **Selector subscriptions:** components subscribe to the slice they use
  (`useCallStore((s) => s.participants)`), not the whole store.
- **No server-authoritative data treated as truth in the store.** Room/role/lifecycle truth comes
  from the backend; the store mirrors it for rendering and is reconciled on server events.
- The store holds UI state only — **no business rules** (limits, validation, role checks). Those
  belong to the backend / domain layer.
- Reset the relevant stores when leaving a room / room ends.
