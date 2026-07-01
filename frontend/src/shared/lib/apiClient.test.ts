import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoom, joinRoom, getRoomStatus } from './apiClient';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('createRoom', () => {
  it('returns roomId and hostToken on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ roomId: 'r1', hostToken: 'h1' }, { status: 201 }));
    const result = await createRoom();
    expect(result).toEqual({ ok: true, data: { roomId: 'r1', hostToken: 'h1' } });
  });

  it('returns INTERNAL on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    const result = await createRoom();
    expect(result).toEqual({ ok: false, error: 'INTERNAL' });
  });
});

describe('getRoomStatus', () => {
  it('maps a 404 to not-found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'NOT_FOUND' }, { ok: false, status: 404 }));
    expect(await getRoomStatus('r1')).toBe('not-found');
  });

  it('returns the parsed status for a known room', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'full' }));
    expect(await getRoomStatus('r1')).toBe('full');
  });
});

describe('joinRoom', () => {
  it('sends the host token in the body and parses a host response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      accessToken: 'jwt', livekitUrl: 'ws://x', role: 'host', identity: 'p_1', displayName: 'Ann', roomId: 'r1',
    }));
    const result = await joinRoom('r1', 'Ann', 'h1');
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ role: 'host', roomId: 'r1' }) });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ name: 'Ann', hostToken: 'h1' });
  });

  it('omits hostToken from the body for a guest join', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      accessToken: 'jwt', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann', roomId: 'r1',
    }));
    await joinRoom('r1', 'Ann');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ name: 'Ann' });
  });

  it('maps a NOT_FOUND error body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'NOT_FOUND' }, { ok: false, status: 404 }));
    const result = await joinRoom('r1', 'Ann');
    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  // Keeps the join-success schema load-bearing (carried over from MR3): a malformed success body
  // (missing token fields) must map to INTERNAL, not slip through as a valid session.
  it('returns INTERNAL when the join success body is malformed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accessToken: 'jwt' }));
    const result = await joinRoom('r1', 'Ann');
    expect(result).toEqual({ ok: false, error: 'INTERNAL' });
  });
});
