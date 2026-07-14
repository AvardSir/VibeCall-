export type NameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'length' | 'chars' };

// Display-name rule. Source of truth: PRD §6. Intentionally duplicated in the frontend
// (frontend/src/features/prejoin/hooks/useNameValidation.ts) for instant client-side feedback;
// the server re-validates as the authority. Keep both copies in sync with the PRD.
// Hyphen is literal at the end of the character class, so no escaping needed (avoids ESLint no-useless-escape).
const NAME_PATTERN = /^[\p{L}\p{N} '-]{2,30}$/u;
const MAX_NAME_LENGTH = 30;

export function validateDisplayName(raw: unknown): NameValidation {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  // Input is capped at 30 before the length check so a long paste reports `length`.
  const capped = trimmed.slice(0, MAX_NAME_LENGTH);
  if (trimmed.length > MAX_NAME_LENGTH || capped.length < 2) {
    return { ok: false, reason: 'length' };
  }
  if (!NAME_PATTERN.test(capped)) return { ok: false, reason: 'chars' };
  return { ok: true, value: capped };
}
