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

  it('setHostIdentity on an unknown room is a no-op (does not throw)', () => {
    const registry = createRoomRegistry();
    expect(() => registry.setHostIdentity('ghost', 'p_x')).not.toThrow();
  });

  it('uses injected generators deterministically', () => {
    let n = 0;
    const registry = createRoomRegistry({ now: () => 123, newToken: () => `t${n++}` });
    const room = registry.create();
    expect(room).toEqual({ roomId: 't0', hostToken: 't1', hostIdentity: null, createdAt: 123, status: 'active', graceEndsAt: null, memberTokens: new Map(), activeSharerId: null });
  });

  it('creates rooms in the active status with no grace deadline', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    expect(room.status).toBe('active');
    expect(room.graceEndsAt).toBeNull();
  });

  it('transitions status and grace deadline through the lifecycle', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    registry.startGraceState(room.roomId, 123456);
    expect(registry.get(room.roomId)).toMatchObject({ status: 'grace', graceEndsAt: 123456 });
    registry.clearGraceState(room.roomId);
    expect(registry.get(room.roomId)).toMatchObject({ status: 'active', graceEndsAt: null });
    registry.setStatus(room.roomId, 'ending');
    expect(registry.get(room.roomId)?.status).toBe('ending');
    registry.markEnded(room.roomId);
    expect(registry.get(room.roomId)).toMatchObject({ status: 'ended', graceEndsAt: null });
  });

  it('lifecycle mutations are no-ops for unknown rooms', () => {
    const registry = createRoomRegistry();
    expect(() => registry.markEnded('ghost')).not.toThrow();
    expect(() => registry.startGraceState('ghost', 1)).not.toThrow();
  });

  it('issues a distinct 128-bit member token per identity and verifies it', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    const t1 = registry.recordMemberToken(room.roomId, 'p_1');
    expect(t1).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(registry.verifyMemberToken(room.roomId, t1)).toBe(true);
    expect(registry.verifyMemberToken(room.roomId, 'nope')).toBe(false);
    expect(registry.verifyMemberToken('ghost', t1)).toBe(false);
  });

  it('recordMemberToken on an unknown room returns empty and stores nothing', () => {
    const registry = createRoomRegistry();
    expect(registry.recordMemberToken('ghost', 'p_1')).toBe('');
  });

  it('revokes a member token so it no longer verifies', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    const token = registry.recordMemberToken(room.roomId, 'p_1');
    expect(registry.verifyMemberToken(room.roomId, token)).toBe(true);
    registry.revokeMemberToken(room.roomId, 'p_1');
    expect(registry.verifyMemberToken(room.roomId, token)).toBe(false);
  });

  it('revokeMemberToken is a no-op for an unknown room or identity', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    const token = registry.recordMemberToken(room.roomId, 'p_1');
    expect(() => registry.revokeMemberToken('ghost', 'p_1')).not.toThrow();
    expect(() => registry.revokeMemberToken(room.roomId, 'p_unknown')).not.toThrow();
    expect(registry.verifyMemberToken(room.roomId, token)).toBe(true);
  });

  it('grants a share to the first claimant and denies a second, distinct one', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    expect(registry.claimShare(room.roomId, 'p_1')).toEqual({ ok: true });
    expect(registry.get(room.roomId)?.activeSharerId).toBe('p_1');
    expect(registry.claimShare(room.roomId, 'p_2')).toEqual({ ok: false, code: 'BUSY' });
    expect(registry.claimShare(room.roomId, 'p_1')).toEqual({ ok: true }); // idempotent for the holder
  });

  it('claimShare on an unknown room returns NOT_FOUND', () => {
    const registry = createRoomRegistry();
    expect(registry.claimShare('ghost', 'p_1')).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('releaseShare clears only for the active sharer', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    registry.claimShare(room.roomId, 'p_1');
    expect(registry.releaseShare(room.roomId, 'p_2')).toBe(false); // not the sharer
    expect(registry.get(room.roomId)?.activeSharerId).toBe('p_1');
    expect(registry.releaseShare(room.roomId, 'p_1')).toBe(true);
    expect(registry.get(room.roomId)?.activeSharerId).toBeNull();
  });

  it('clearShare unconditionally clears and reports whether it changed', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    registry.claimShare(room.roomId, 'p_1');
    expect(registry.clearShare(room.roomId)).toBe(true);
    expect(registry.get(room.roomId)?.activeSharerId).toBeNull();
    expect(registry.clearShare(room.roomId)).toBe(false); // already clear
  });

  it('getActiveSharer reflects the current sharer and null for none/unknown rooms', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    expect(registry.getActiveSharer(room.roomId)).toBeNull();
    registry.claimShare(room.roomId, 'p_1');
    expect(registry.getActiveSharer(room.roomId)).toBe('p_1');
    expect(registry.getActiveSharer('ghost')).toBeNull();
  });
});
