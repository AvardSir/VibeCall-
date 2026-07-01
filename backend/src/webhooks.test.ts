import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { createWebhookHandler } from './webhooks.js';

function res() {
  const r = { statusCode: 200, sendStatus: vi.fn((c: number) => { r.statusCode = c; return r; }), end: vi.fn(() => r) };
  return r as never;
}
function req(body: string) { return { body, header: () => 'auth' } as never; }

describe('createWebhookHandler', () => {
  it('starts grace when the host leaves an active room unexpectedly', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_host' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active', activeSharerId: null })), clearShare: vi.fn(() => false) };
    const handler = createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace, onShareCleared: vi.fn() });
    await handler(req('{}'), res(), vi.fn());
    expect(grace.startGrace).toHaveBeenCalledWith('r1');
  });

  it('does NOT start grace when a guest leaves', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_guest' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active', activeSharerId: null })), clearShare: vi.fn(() => false) };
    await createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace, onShareCleared: vi.fn() })(req('{}'), res(), vi.fn());
    expect(grace.startGrace).not.toHaveBeenCalled();
  });

  it('does NOT start grace when the host leaves an ending room (intentional end)', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_host' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'ending', activeSharerId: null })), clearShare: vi.fn(() => false) };
    await createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace, onShareCleared: vi.fn() })(req('{}'), res(), vi.fn());
    expect(grace.startGrace).not.toHaveBeenCalled();
  });

  it('responds 401 on a bad signature', async () => {
    const grace = { startGrace: vi.fn() };
    const receiver = { receive: vi.fn().mockRejectedValue(new Error('bad sig')) };
    const r = res();
    await createWebhookHandler({ receiver: receiver as never, registry: { get: vi.fn(), clearShare: vi.fn() } as never, grace, onShareCleared: vi.fn() })(req('{}'), r, vi.fn());
    expect((r as { sendStatus: Mock }).sendStatus).toHaveBeenCalledWith(401);
  });

  it('clears the share when the active sharer leaves', async () => {
    const clearShare = vi.fn(() => true);
    const onShareCleared = vi.fn();
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_sharer' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active', activeSharerId: 'p_sharer' })), clearShare };
    const handler = createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace: { startGrace: vi.fn() }, onShareCleared });
    await handler(req('{}'), res(), vi.fn());
    expect(clearShare).toHaveBeenCalledWith('r1');
    expect(onShareCleared).toHaveBeenCalledWith('r1');
  });

  it('force-clears the share when the host enters grace', async () => {
    const clearShare = vi.fn(() => true);
    const onShareCleared = vi.fn();
    const startGrace = vi.fn();
    const receiver = { receive: vi.fn().mockResolvedValue({ event: 'participant_left', room: { name: 'r1' }, participant: { identity: 'p_host' } }) };
    const registry = { get: vi.fn(() => ({ roomId: 'r1', hostIdentity: 'p_host', status: 'active', activeSharerId: 'p_host' })), clearShare };
    await createWebhookHandler({ receiver: receiver as never, registry: registry as never, grace: { startGrace }, onShareCleared })(req('{}'), res(), vi.fn());
    expect(startGrace).toHaveBeenCalledWith('r1');
    expect(clearShare).toHaveBeenCalledWith('r1');
    expect(onShareCleared).toHaveBeenCalledWith('r1');
  });
});
