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
      title={tooltip}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      className="inline-flex items-center gap-2 text-sm text-slate-300 transition disabled:opacity-40"
    >
      {/* Decorative track + thumb; the visible label provides the accessible name. */}
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full transition-colors ${
          pressed ? 'bg-accent' : 'bg-surface-muted'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            pressed ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
      {label}
    </button>
  );
}
