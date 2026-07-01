import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Request, Response } from 'express';
import { createApp } from '../../app.js';
import type { AppConfig } from '../../config.js';
import { createRoomRegistry } from '../../rooms.js';
import { createDownloadRouter } from './downloadRouter.js';

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
  };
  return {
    app: createApp({ config, registry, admin, minter, grace, io: io as never, webhookHandler, attachments }),
    registry,
    attachments,
  };
}

describe('GET /attachments/:roomName/:fileId/:name', () => {
  it('rejects a request with no token with 403 FORBIDDEN', async () => {
    const { app, registry } = makeApp();
    const room = registry.create();

    const res = await request(app).get(`/attachments/${room.roomId}/file123/c.png`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN' });
  });

  it('rejects an unknown room with 404 NOT_FOUND', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/attachments/does-not-exist/file123/c.png?token=whatever');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('rejects a valid token but an unresolvable file with 404 NOT_FOUND', async () => {
    const { app, registry, attachments } = makeApp();
    const room = registry.create();
    const token = registry.recordMemberToken(room.roomId, 'p_1');
    attachments.resolvePath.mockResolvedValueOnce(null);

    const res = await request(app).get(`/attachments/${room.roomId}/file123/c.png?token=${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('calls the injected sendFile with the resolved path + name given a valid token', async () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    const token = registry.recordMemberToken(room.roomId, 'p_1');
    const resolvePath = vi.fn().mockResolvedValue('/uploads/room/file123__c.png');
    const sendFile = vi.fn((res: Response) => res.sendStatus(200));

    const app = express();
    app.use(createDownloadRouter({ registry, attachments: { resolvePath }, sendFile }));

    const res = await request(app).get(`/attachments/${room.roomId}/file123/c.png?token=${token}`);

    expect(resolvePath).toHaveBeenCalledWith(room.roomId, 'file123');
    expect(sendFile).toHaveBeenCalledWith(expect.anything(), '/uploads/room/file123__c.png', 'c.png');
    expect(res.status).toBe(200);
  });
});
