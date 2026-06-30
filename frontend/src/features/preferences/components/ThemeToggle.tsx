// frontend/src/features/preferences/components/ThemeToggle.tsx
import type { JSX } from 'react';

export type ThemeToggleProps = {
  theme: 'dark' | 'light';
  label: string;
  onToggle: () => void;
};

export function ThemeToggle({ theme, label, onToggle }: ThemeToggleProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onToggle}
      className="grid h-9 w-9 place-items-center rounded-full text-slate-700 transition hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
