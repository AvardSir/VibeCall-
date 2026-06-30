import { validateDisplayName } from '../../validation.js';
import { AppError } from '../../errors.js';

// Request-payload validation for the rooms routes. Delegates the display-name rule to the
// validation service and surfaces a typed AppError so the controller stays thin.
export function parseJoinBody(body: unknown): { name: string } {
  const raw = typeof body === 'object' && body !== null ? (body as { name?: unknown }).name : undefined;
  const result = validateDisplayName(raw);
  if (!result.ok) throw new AppError('INVALID_NAME');
  return { name: result.value };
}
