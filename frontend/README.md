# Frontend — kmb-video-chat

React 19 + TypeScript + Vite. Styling via Tailwind CSS v4 (CSS-first config in `src/index.css`).

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b (no emit)
npm run lint       # ESLint (incl. feature-boundary enforcement)
npm run lint:fix   # ESLint autofix
npm run test       # Vitest (run once)
npm run test:watch # Vitest (watch)
```

## Linting

ESLint is the single linter. It carries the rules this project depends on that have no fast-linter
equivalent: `eslint-plugin-boundaries` (enforces the feature-based import boundaries from
`.claude/rules/20-frontend-structure.md`) and type-aware `typescript-eslint` rules.

## Styling

Tailwind v4 — no `tailwind.config.js` / PostCSS. The `@tailwindcss/vite` plugin is wired in
`vite.config.ts`; theme tokens and the class-based `dark` variant live in `src/index.css`.
