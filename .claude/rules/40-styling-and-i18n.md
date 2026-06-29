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
- Desktop only (≥1024px) — no responsive breakpoints below that are required.

## react-i18next

- **No hardcoded user-facing strings in components.** Every label, message, button, and error
  goes through `t('key')`.
- Resources live in `shared/i18n/` with parallel **EN** and **RU** files; every key exists in both.
- Namespacing by feature is encouraged (`call`, `chat`, `prejoin`, `roomStates`, `common`).
- Use interpolation for dynamic values (`t('grace.reconnecting', { seconds })`), never string
  concatenation.
- Exact product wording (status/error strings) is defined in the spec — store those verbatim as
  translation values; the spec, not the component, is the source of truth for the text.
