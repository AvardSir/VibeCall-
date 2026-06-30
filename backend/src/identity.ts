import { randomUUID } from 'node:crypto';

// Participant identities are prefixed `p_` (p = participant) to mark them as server-generated
// LiveKit identities, kept distinct from display names and any future non-participant ids.
export function generateIdentity(): string {
  return `p_${randomUUID()}`;
}
