import type { JSX } from 'react';

export type FileChipProps = { name: string; size: number; href: string; downloadLabel: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function FileChip({ name, size, href, downloadLabel }: FileChipProps): JSX.Element {
  return (
    <a
      href={href}
      download={name}
      aria-label={`${downloadLabel}: ${name}`}
      className="inline-flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-slate-100 hover:bg-surface-muted/80"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 fill-none stroke-current"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
      </svg>
      <span className="min-w-0 truncate">{name}</span>
      <span className="shrink-0 text-xs text-slate-400">{formatBytes(size)}</span>
    </a>
  );
}
