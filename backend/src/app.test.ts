import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';
import { createRoomRegistry } from './rooms.js';

const config: AppConfig = {
  livekitApiKey: 'k', livekitApiSecret: 's',
  livekitUrl: 'ws://localhost:7880', livekitHost: 'http://localhost:7880',
  port: 3000, corsOrigin: '*',
  maxParticipants: 4, emptyTimeoutSeconds: 300,
};

function makeApp(count: number) {
  const registry = createRoomRegistry();
  const admin = {
    ensureRoom: vi.fn().mockResolvedValue(undefined),
    listParticipantCount: vi.fn().mockResolvedValue(count),
  };
  const minter = {
    mintGuestToken: vi.fn().mockResolvedValue('guest.jwt'),
    mintHostToken: vi.fn().mockResolvedValue('host.jwt'),
  };
  return { app: createApp({ config, registry, admin, minter }), registry, admin, minter };
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
    expect(res.body).toMatchObject({ accessToken: 'guest.jwt', role: 'guest', displayName: 'Ann', roomId: room.roomId });
    expect(res.body.identity).toMatch(/^p_/);
    expect(minter.mintGuestToken).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ann', room: room.roomId }),
    );
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
