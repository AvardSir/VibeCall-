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
- **Cover the composition root, not only the units — and smoke the real running app.** Integration
  crashes hide in the wiring layer (`server.ts`: httpServer + Socket.IO + Express; the frontend
  provider tree around the in-call view). Unit tests that exercise `createApp` or mock the
  provider/socket chain in isolation pass while the assembled app is dead. So: (1) add a test at the
  composition layer (e.g. assert the wired `httpServer` has exactly **one** `request` listener plus a
  socket-handshake round-trip that proves the process survives; render the real provider tree, don't
  mock it away); and (2) before calling a backend/full-stack feature "done", **manually smoke the real
  `docker compose up --build` stack** — hit `POST /rooms` *and* a `/socket.io/?EIO=4&transport=polling`
  handshake, and click the actual UI flow. "typecheck + lint + N green tests" is **not** "it works":
  two user-facing crashes (M3 SocketProvider, M4 server wiring) slipped past green unit gates exactly
  this way.
