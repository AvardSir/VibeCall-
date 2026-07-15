# Styling & Localization

## Tailwind CSS

- Style with Tailwind utility classes; avoid ad-hoc CSS files and inline `style` except for truly
  dynamic values (e.g. computed grid sizing).
- **Theming via `dark:` variants** — Dark is the default theme, Light is the alternate. Drive the
  active theme from `useUiStore`; do not hardcode colors that ignore the theme.
- Pull repeated color/spacing decisions into the Tailwind config (theme tokens) rather than
  repeating magic values.
- Keep long class lists readable; extract a small presentational component before a `className`
  becomes unmanageable.
- **Compose conditional classes with `clsx`** (not string concatenation / nested ternaries) —
  `clsx(SIZE[size], WEIGHT[weight], active && 'text-accent', className)`.
- Map component variants to **real Tailwind tokens only.** Our theme (Tailwind v4 `@theme` in
  `index.css`) defines colors, not custom font-size tokens — use the default scale (`text-xs …
  text-2xl`); there is no `text-md` / `text-xxs` / `text-display-*`. Don't emit class names that
  resolve to nothing.
- Desktop only (≥1024px) — no responsive breakpoints below that are required.
- **Inline SVG icons use `currentColor`** — author icon `fill`/`stroke` as `currentColor` (never a
  baked hex) so an icon inherits its color from the surrounding `text-*` class and adapts to the
  `dark:` theme for free. Set the color on the icon's container via Tailwind, not inside the SVG.

## Shared UI (styling ownership)

- **Tooltips are custom** (`shared/ui/Tooltip.tsx`) — the design's tooltips can't be matched by the
  native `title` attribute, so don't use `title` for tooltips (see `20-frontend-structure.md`).
- **Typography goes through `<Text>`.** It owns size/weight/transform classes but **not color** —
  pass color via `className` at the call site so color stays a per-use decision, not baked into Text.

## react-i18next

- **No hardcoded user-facing strings in components.** Every label, message, button, and error
  goes through `t('key')`.
- Resources live in `shared/i18n/` with parallel **EN** and **RU** files; every key exists in both.
- Namespacing by feature is encouraged (`call`, `chat`, `prejoin`, `roomStates`, `common`).
- Use interpolation for dynamic values (`t('grace.reconnecting', { seconds })`), never string
  concatenation.
- Exact product wording (status/error strings) is defined in the spec — store those verbatim as
  translation values; the spec, not the component, is the source of truth for the text.
