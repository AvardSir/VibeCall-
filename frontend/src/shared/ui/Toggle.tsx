import type { JSX } from 'react';

export type ToggleProps = {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onChange: (pressed: boolean) => void;
};

export function Toggle({ label, pressed, disabled, onChange }: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
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
