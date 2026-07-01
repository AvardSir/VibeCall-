import { describe, it, expect } from 'vitest';
import { createRoomRegistry } from './rooms.js';

describe('createRoomRegistry', () => {
  it('creates a room with distinct 128-bit roomId and hostToken', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    // base64url of 16 random bytes → 22 chars, no padding
    expect(room.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(room.hostToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(room.roomId).not.toBe(room.hostToken);
    expect(room.hostIdentity).toBeNull();
  });

  it('retrieves a created room by id and returns undefined for unknown ids', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    expect(registry.get(room.roomId)).toEqual(room);
    expect(registry.get('nope')).toBeUndefined();
  });

  it('verifies the host token only for the matching room', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    expect(registry.verifyHostToken(room.roomId, room.hostToken)).toBe(true);
    expect(registry.verifyHostToken(room.roomId, 'wrong')).toBe(false);
    expect(registry.verifyHostToken('unknown', room.hostToken)).toBe(false);
  });

  it('records the host identity on the room', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    registry.setHostIdentity(room.roomId, 'p_host');
    expect(registry.get(room.roomId)?.hostIdentity).toBe('p_host');
  });

  it('uses injected generators deterministically', () => {
    let n = 0;
    const registry = createRoomRegistry({ now: () => 123, newToken: () => `t${n++}` });
    const room = registry.create();
    expect(room).toEqual({ roomId: 't0', hostToken: 't1', hostIdentity: null, createdAt: 123 });
  });
});
