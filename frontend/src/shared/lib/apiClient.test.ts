import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRoomStatus, joinRoom } from './apiClient';

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response));
}

describe('getRoomStatus', () => {
  it('returns the status field', async () => {
    mockFetch(200, { status: 'full' });
    expect(await getRoomStatus('main')).toBe('full');
  });
});

describe('joinRoom', () => {
  it('returns ok with data on success', async () => {
    const data = { accessToken: 'jwt', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann' };
    mockFetch(200, data);
    const result = await joinRoom('main', 'Ann');
    expect(result).toEqual({ ok: true, data });
  });

  it('returns the error code on 409 FULL', async () => {
    mockFetch(409, { error: 'FULL' });
    expect(await joinRoom('main', 'Ann')).toEqual({ ok: false, error: 'FULL' });
  });

  it('returns INVALID_NAME on 400', async () => {
    mockFetch(400, { error: 'INVALID_NAME' });
    expect(await joinRoom('main', 'A')).toEqual({ ok: false, error: 'INVALID_NAME' });
  });
});
