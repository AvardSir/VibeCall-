import { z } from 'zod';

// Display-name rule. Source of truth: PRD §6. Intentionally duplicated in the frontend
// (frontend/src/features/prejoin/hooks/useNameValidation.ts) for instant client-side feedback;
// the server re-validates as the authority. Keep both copies in sync with the PRD.
// Hyphen is literal at the end of the character class, so no escaping needed (avoids ESLint no-useless-escape).
const NAME_PATTERN = /^[\p{L}\p{N} '-]{2,30}$/u;

// Trim first, then enforce the 2–30 allowed-character rule on the trimmed value. The pattern
// covers both length and the character set, so a single regex check suffices after trimming.
export const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().regex(NAME_PATTERN));
