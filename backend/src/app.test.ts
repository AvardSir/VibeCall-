import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response } from 'express';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';
import { createRoomRegistry } from './rooms.js';

const config: AppConfig = {
  livekitApiKey: 'k', livekitApiSecret: 's',
  livekitUrl: 'ws://localhost:7880', livekitHost: 'http://localhost:7880',
  port: 3000, corsOrigin: '*',
  maxParticipants: 4, emptyTimeoutSeconds: 300, graceTimeoutSeconds: 60,
  attachmentStoragePath: './uploads',
};

function makeApp(count: number) {
  const registry = createRoomRegistry();
  const admin = {
    ensureRoom: vi.fn().mockResolvedValue(undefined),
    listParticipantCount: vi.fn().mockResolvedValue(count),
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
  return {
    // `io` is a minimal fake (only `to().emit()` is used by the controller), not a full
    // socket.io Server — cast at this one boundary rather than widening the real ChatServer type.
    app: createApp({ config, registry, admin, minter, grace, io: io as never, webhookHandler }),
    registry,
    admin,
    minter,
    grace,
    io,
    webhookHandler,
  };
}

describe('POST /rooms', () => {
  it('creates a room and returns roomId + hostToken', async () => {
    const { app, admin } = makeApp(0);
    const res = await request(app).post('/rooms');
    expect(res.status).toBe(201);
    expect(res.body.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(res.body.hostToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(admin.ensureRoom).toHaveBeenCalledWith(res.body.roomId);
  });
});

describe('GET /rooms/:roomId', () => {
  it('returns 404 NOT_FOUND for an unknown room', async () => {
    const { app } = makeApp(0);
    const res = await request(app).get('/rooms/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('returns available below capacity for a known room', async () => {
    const { app, registry } = makeApp(3);
    const room = registry.create();
    const res = await request(app).get(`/rooms/${room.roomId}`);
    expect(res.body).toEqual({ status: 'available' });
  });

  it('returns full at capacity', async () => {
    const { app, registry } = makeApp(4);
    const room = registry.create();
    const res = await request(app).get(`/rooms/${room.roomId}`);
    expect(res.body).toEqual({ status: 'full' });
  });
});

describe('POST /rooms/:roomId/join', () => {
  it('issues a guest token when no host token is supplied', async () => {
    const { app, registry, minter } = makeApp(0);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accessToken: 'guest.jwt', role: 'guest', displayName: 'Ann', roomId: room.roomId, livekitUrl: 'ws://localhost:7880' });
    expect(res.body.identity).toMatch(/^p_/);
    expect(res.body.memberToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(minter.mintGuestToken).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ann', room: room.roomId }),
    );
  });

  it('two joins with the same display name receive distinct identities', async () => {
    const { app, registry } = makeApp(2);
    const room = registry.create();
    const a = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    const b = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    expect(a.body.identity).not.toBe(b.body.identity);
  });

  it('issues a host token for a valid host token', async () => {
    const { app, registry, minter } = makeApp(0);
    const room = registry.create();
    const res = await request(app)
      .post(`/rooms/${room.roomId}/join`)
      .send({ name: 'Host', hostToken: room.hostToken });
    expect(res.body).toMatchObject({ accessToken: 'host.jwt', role: 'host' });
    expect(minter.mintHostToken).toHaveBeenCalledOnce();
    expect(registry.get(room.roomId)?.hostIdentity).toBe(res.body.identity);
  });

  it('rejects an invalid host token as NOT_FOUND', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    const res = await request(app)
      .post(`/rooms/${room.roomId}/join`)
      .send({ name: 'Mallory', hostToken: 'wrong' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('rejects join for an unknown room with NOT_FOUND', async () => {
    const { app } = makeApp(0);
    const res = await request(app).post('/rooms/unknown/join').send({ name: 'Ann' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('rejects join at capacity with FULL', async () => {
    const { app, registry } = makeApp(4);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'FULL' });
  });

  it('rejects an invalid name with INVALID_NAME', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_NAME' });
  });
});

describe('POST /rooms/:roomId/end', () => {
  it('ends the room (204), sets ending status, deletes the LiveKit room, broadcasts room_ended', async () => {
    const { app, registry, admin, io } = makeApp(2);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/end`).send({ hostToken: room.hostToken });
    expect(res.status).toBe(204);
    expect(admin.deleteRoom).toHaveBeenCalledWith(room.roomId);
    expect(registry.get(room.roomId)?.status).toBe('ended');
    expect(io.to).toHaveBeenCalledWith(room.roomId); // room_ended broadcast
  });
  it('rejects a wrong host token with 404', async () => {
    const { app, registry } = makeApp(2);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/end`).send({ hostToken: 'wrong' });
    expect(res.status).toBe(404);
  });
});

describe('POST /rooms/:roomId/remove', () => {
  it('removes a guest (204) via LiveKit and notifies the guest', async () => {
    const { app, registry, admin, io } = makeApp(3);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/remove`).send({ hostToken: room.hostToken, targetIdentity: 'p_guest' });
    expect(res.status).toBe(204);
    expect(admin.removeParticipant).toHaveBeenCalledWith(room.roomId, 'p_guest');
    expect(io.to).toHaveBeenCalledWith(room.roomId); // participant_removed broadcast
  });
  it('rejects a wrong host token with 404', async () => {
    const { app, registry, admin } = makeApp(3);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/remove`).send({ hostToken: 'wrong', targetIdentity: 'p_guest' });
    expect(res.status).toBe(404);
    expect(admin.removeParticipant).not.toHaveBeenCalled();
  });
});

describe('join lifecycle', () => {
  it('returns ENDED (410) when joining an ended room', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    registry.markEnded(room.roomId);
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: 'ENDED' });
  });
  it('cancels grace and admits the returning host', async () => {
    const { app, registry, grace } = makeApp(0);
    const room = registry.create();
    registry.startGraceState(room.roomId, 1);
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Host', hostToken: room.hostToken });
    expect(res.body.role).toBe('host');
    expect(grace.cancelGrace).toHaveBeenCalledWith(room.roomId);
  });
  it('reserves the host slot: a 4th guest is refused (FULL) during grace at 3 participants', async () => {
    const { app, registry } = makeApp(3); // 3 live guests
    const room = registry.create();
    registry.startGraceState(room.roomId, 1);
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Guest4' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'FULL' });
  });
});

describe('POST /webhooks/livekit', () => {
  it('mounts the raw-body route ahead of express.json() and delegates to the injected handler', async () => {
    const { app, webhookHandler } = makeApp(0);
    const res = await request(app)
      .post('/webhooks/livekit')
      .set('Content-Type', 'application/webhook+json')
      .send(JSON.stringify({ event: 'participant_left' }));
    expect(res.status).toBe(200);
    expect(webhookHandler).toHaveBeenCalledOnce();
  });
});

describe('GET status ended', () => {
  it('returns ended for an ended room', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    registry.markEnded(room.roomId);
    const res = await request(app).get(`/rooms/${room.roomId}`);
    expect(res.body).toEqual({ status: 'ended' });
  });
});
