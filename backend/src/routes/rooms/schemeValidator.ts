import { z } from 'zod';
import { nameSchema } from '../../validation.js';
import { AppError } from '../../errors.js';

// Request-payload schema for the join route. Reuses the display-name rule (validation.ts).
// hostToken is optional: its presence (and validity) is what elevates a join to the host role.
const joinBodySchema = z.object({ name: nameSchema, hostToken: z.string().optional() });

export function parseJoinBody(body: unknown): { name: string; hostToken?: string } {
  const result = joinBodySchema.safeParse(body);
  if (!result.success) throw new AppError('INVALID_NAME');
  return { name: result.data.name, hostToken: result.data.hostToken };
}

// end/remove are host-only paths: a malformed body is treated the same as a bad room/token
// (NOT_FOUND) so we don't leak details about why the request was refused.
const endBodySchema = z.object({ hostToken: z.string().min(1) });

export function parseEndBody(body: unknown): { hostToken: string } {
  const result = endBodySchema.safeParse(body);
  if (!result.success) throw new AppError('NOT_FOUND');
  return result.data;
}

const removeBodySchema = z.object({
  hostToken: z.string().min(1),
  targetIdentity: z.string().min(1),
});

export function parseRemoveBody(body: unknown): { hostToken: string; targetIdentity: string } {
  const result = removeBodySchema.safeParse(body);
  if (!result.success) throw new AppError('NOT_FOUND');
  return result.data;
}
