import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  getRoomStatus,
  endCall,
  removeParticipant,
  uploadAttachment,
  attachmentDownloadUrl,
} from './apiClient';

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

  it('rejects on a non-ok non-404 response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    await expect(getRoomStatus('r1')).rejects.toThrow();
  });

  it('maps 410 to ended', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 410, json: () => Promise.resolve({ error: 'ENDED' }) } as Response);
    expect(await getRoomStatus('r1')).toBe('ended');
  });
});

describe('joinRoom', () => {
  it('sends the host token in the body and parses a host response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      accessToken: 'jwt', livekitUrl: 'ws://x', role: 'host', identity: 'p_1', displayName: 'Ann', roomId: 'r1', memberToken: 'm1',
    }));
    const result = await joinRoom('r1', 'Ann', 'h1');
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ role: 'host', roomId: 'r1', memberToken: 'm1' }) });
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

describe('endCall / removeParticipant', () => {
  it('endCall posts the host token and returns true on 204', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    expect(await endCall('r1', 'h1')).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ hostToken: 'h1' });
  });
  it('removeParticipant posts hostToken + targetIdentity', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    expect(await removeParticipant('r1', 'h1', 'p_2')).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ hostToken: 'h1', targetIdentity: 'p_2' });
  });
});

describe('uploadAttachment', () => {
  it('uploadAttachment posts FormData with the member token and parses the attachment', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          fileId: 'f0',
          name: 'c.png',
          size: 3,
          mime: 'image/png',
          kind: 'image',
          url: '/attachments/r1/f0/c.png',
        }),
    } as Response);
    const file = new File([new Uint8Array([1, 2, 3])], 'c.png', { type: 'image/png' });
    const r = await uploadAttachment('r1', 'm1', file);
    expect(r).toEqual({ ok: true, data: expect.objectContaining({ fileId: 'f0', kind: 'image' }) });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['x-member-token']).toBe('m1');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('maps an upload 415 to UNSUPPORTED_TYPE', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 415,
      json: () => Promise.resolve({ error: 'UNSUPPORTED_TYPE' }),
    } as Response);
    const file = new File([new Uint8Array([1])], 'a.exe', { type: 'application/octet-stream' });
    expect(await uploadAttachment('r1', 'm1', file)).toEqual({ ok: false, error: 'UNSUPPORTED_TYPE' });
  });
});

describe('attachmentDownloadUrl', () => {
  it('builds an absolute URL with the member token as a query param', () => {
    const url = attachmentDownloadUrl(
      { fileId: 'f0', name: 'c.png', size: 3, mime: 'image/png', kind: 'image', url: '/attachments/r1/f0/c.png' },
      'm1',
    );
    expect(url).toContain('http://localhost:3000');
    expect(url).toContain('?token=m1');
  });
});
