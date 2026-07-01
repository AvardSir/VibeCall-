import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';

describe('M4 i18n keys', () => {
  it('exposes M4 roomStates + call keys with EN/RU parity', () => {
    for (const k of ['endedTitle','hostEndedTitle','leftTitle','rejoin','removedTitle','graceOverlay','graceCountdown','graceExpiredTitle','removeDialogTitle','removeConfirm','removeCancel'])
      expect(en.roomStates).toHaveProperty(k);
    for (const k of ['endCall','endCallTooltip','removeGuest','removeGuestTooltip'])
      expect(en.call).toHaveProperty(k);
    expect(Object.keys(ru.roomStates)).toEqual(Object.keys(en.roomStates));
    expect(Object.keys(ru.call)).toEqual(Object.keys(en.call));
    expect(en.roomStates.graceExpiredTitle).toBe('The host has disconnected and the call has ended.');
    expect(en.roomStates.graceCountdown).toBe('Reconnecting... {{n}}s');
  });
});
