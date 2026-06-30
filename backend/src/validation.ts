export type NameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'length' | 'chars' };

// Hyphen is literal at the end of character class, so no escaping needed (unescaped form avoids ESLint no-useless-escape)
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
