# Testing

- **Co-locate tests:** `*.test.ts` (or `*.test.tsx`) next to the source file under test.
- Test **behavior and rules**, not implementation details — especially the server-authoritative
  logic (capacity, role enforcement, grace timer, validation) and store actions.
- Keep tests deterministic: fake timers for the grace countdown; mock LiveKit/Socket.IO and the
  filesystem rather than hitting real services.
- A unit must pass `npm run typecheck` and `npm run lint` as part of being "done"; tests are not a
  substitute for a clean build.
- Frontend: prefer testing hooks and stores directly; test components through user-visible
  behavior (rendered output / interactions), not internal state.
