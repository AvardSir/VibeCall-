import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';

const config: AppConfig = {
  livekitApiKey: 'k', livekitApiSecret: 's',
  livekitUrl: 'ws://localhost:7880', livekitHost: 'http://localhost:7880',
  port: 3000, corsOrigin: '*', fixedRoomName: 'main',
  maxParticipants: 4, emptyTimeoutSeconds: 300,
};

function makeApp(count: number) {
  const admin = { listParticipantCount: vi.fn().mockResolvedValue(count) };
  const minter = { mintGuestToken: vi.fn().mockResolvedValue('jwt.token.value') };
  return { app: createApp({ config, admin, minter }), admin, minter };
}

describe('GET /rooms/:roomName', () => {
  it('returns available below capacity', async () => {
    const { app } = makeApp(3);
    const res = await request(app).get('/rooms/main');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'available' });
  });

  it('returns full at capacity', async () => {
    const { app } = makeApp(4);
    const res = await request(app).get('/rooms/main');
    expect(res.body).toEqual({ status: 'full' });
  });
});

describe('POST /rooms/:roomName/join', () => {
  it('issues a guest token below capacity', async () => {
    const { app, minter } = makeApp(0);
    const res = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accessToken: 'jwt.token.value',
      livekitUrl: 'ws://localhost:7880',
      role: 'guest',
      displayName: 'Ann',
    });
    expect(res.body.identity).toMatch(/^p_/);
    expect(minter.mintGuestToken).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ann', room: 'main' }),
    );
  });

  it('rejects join at capacity with FULL', async () => {
    const { app } = makeApp(4);
    const res = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'FULL' });
  });

  it('rejects an invalid name with INVALID_NAME', async () => {
    const { app } = makeApp(0);
    const res = await request(app).post('/rooms/main/join').send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_NAME' });
  });

  it('allows duplicate display names with distinct identities', async () => {
    const { app } = makeApp(1);
    const a = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    const b = await request(app).post('/rooms/main/join').send({ name: 'Ann' });
    expect(a.body.displayName).toBe('Ann');
    expect(b.body.displayName).toBe('Ann');
    expect(a.body.identity).not.toBe(b.body.identity);
  });
});
