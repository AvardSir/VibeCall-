import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response } from 'express';
import { createApp } from '../../app.js';
import type { AppConfig } from '../../config.js';
import { createRoomRegistry } from '../../rooms.js';
import { AppError } from '../../errors.js';

const config: AppConfig = {
  livekitApiKey: 'k', livekitApiSecret: 's',
  livekitUrl: 'ws://localhost:7880', livekitHost: 'http://localhost:7880',
  port: 3000, corsOrigin: '*',
  maxParticipants: 4, emptyTimeoutSeconds: 300, graceTimeoutSeconds: 60,
  attachmentStoragePath: './uploads',
};

function makeApp() {
  const registry = createRoomRegistry();
  const admin = {
    ensureRoom: vi.fn().mockResolvedValue(undefined),
    listParticipantCount: vi.fn().mockResolvedValue(0),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
  };
  const minter = {
    mintGuestToken: vi.fn().mockResolvedValue('guest.jwt'),
    mintHostToken: vi.fn().mockResolvedValue('host.jwt'),
  };
  const grace = {
    cancelGrace: vi.fn(),
  };
  const io = {
    to: vi.fn(() => ({ emit: vi.fn() })),
  };
  const webhookHandler = vi.fn((_req: Request, res: Response) => res.sendStatus(200));
  const attachments = {
    validateAndStore: vi.fn().mockResolvedValue({
      fileId: 'file123',
      name: 'c.png',
      size: 3,
      mime: 'image/png',
      kind: 'image',
      url: '/attachments/room/file123/c.png',
    }),
    resolvePath: vi.fn().mockResolvedValue(null),
    deleteRoomFolder: vi.fn().mockResolvedValue(undefined),
  };
  const chat = {
    clear: vi.fn(),
  };
  return {
    app: createApp({ config, registry, admin, minter, grace, io: io as never, webhookHandler, attachments, chat }),
    registry,
    attachments,
  };
}

describe('POST /rooms/:roomId/attachments', () => {
  it('uploads a file with a valid member token and returns 201 + attachment shape', async () => {
    const { app, registry, attachments } = makeApp();
    const room = registry.create();
    const token = registry.recordMemberToken(room.roomId, 'p_1');

    const res = await request(app)
      .post(`/rooms/${room.roomId}/attachments`)
      .set('x-member-token', token)
      .attach('file', Buffer.from('img'), 'c.png');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      fileId: 'file123',
      name: 'c.png',
      size: 3,
      mime: 'image/png',
      kind: 'image',
      url: '/attachments/room/file123/c.png',
    });
    expect(attachments.validateAndStore).toHaveBeenCalledWith(
      expect.objectContaining({ roomName: room.roomId, originalName: 'c.png', mime: 'image/png' }),
    );
  });

  it('rejects a missing/invalid member token with 403 FORBIDDEN', async () => {
    const { app, registry } = makeApp();
    const room = registry.create();

    const res = await request(app)
      .post(`/rooms/${room.roomId}/attachments`)
      .set('x-member-token', 'wrong')
      .attach('file', Buffer.from('img'), 'c.png');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN' });
  });

  it('rejects an unknown room with 404 NOT_FOUND', async () => {
    const { app } = makeApp();

    const res = await request(app)
      .post('/rooms/does-not-exist/attachments')
      .set('x-member-token', 'whatever')
      .attach('file', Buffer.from('img'), 'c.png');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('rejects an unsupported file type with 415', async () => {
    const { app, registry, attachments } = makeApp();
    const room = registry.create();
    const token = registry.recordMemberToken(room.roomId, 'p_1');
    attachments.validateAndStore.mockRejectedValueOnce(new AppError('UNSUPPORTED_TYPE'));

    const res = await request(app)
      .post(`/rooms/${room.roomId}/attachments`)
      .set('x-member-token', token)
      .attach('file', Buffer.from('bad'), 'c.exe');

    expect(res.status).toBe(415);
  });

  it('rejects a file exceeding the size limit with 413', async () => {
    const { app, registry } = makeApp();
    const room = registry.create();
    const token = registry.recordMemberToken(room.roomId, 'p_1');
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);

    const res = await request(app)
      .post(`/rooms/${room.roomId}/attachments`)
      .set('x-member-token', token)
      .attach('file', oversized, 'big.png');

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'FILE_TOO_LARGE' });
  });
});
