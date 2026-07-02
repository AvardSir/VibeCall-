import { describe, it, expect, afterEach, vi } from 'vitest';
import { get } from 'node:http';
import type { Request, Response } from 'express';
import { buildHttpServer } from './server.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket.js';
import type { ChatServer } from './socket.js';
import { createRoomRegistry } from './rooms.js';
import type { AppConfig } from './config.js';

const config: AppConfig = {
  livekitApiKey: 'k',
  livekitApiSecret: 's',
  livekitUrl: 'ws://localhost:7880',
  livekitHost: 'http://localhost:7880',
  port: 3000,
  corsOrigin: '*',
  maxParticipants: 4,
  emptyTimeoutSeconds: 300,
  graceTimeoutSeconds: 60,
  attachmentStoragePath: './uploads',
};

function makeAppAndIo(): { app: ReturnType<typeof createApp>; io: ChatServer } {
  const registry = createRoomRegistry();
  const admin = {
    ensureRoom: vi.fn().mockResolvedValue(undefined),
    listParticipantCount: vi.fn().mockResolvedValue(0),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    listParticipants: vi.fn().mockResolvedValue([]),
  };
  const minter = {
    mintGuestToken: vi.fn().mockResolvedValue('guest.jwt'),
    mintHostToken: vi.fn().mockResolvedValue('host.jwt'),
  };
  const grace = {
    cancelGrace: vi.fn(),
  };
  const chat = {
    history: vi.fn(() => []),
    build: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
  };
  // Real, detached Socket.IO server (fake admin/chat deps) — this is the object under test.
  const io = createSocketServer({ config: { corsOrigin: config.corsOrigin }, admin, chat: chat as never, registry });
  const webhookHandler = vi.fn((_req: Request, res: Response) => res.sendStatus(200));
  const attachments = {
    validateAndStore: vi.fn().mockResolvedValue({
      fileId: 'file123', name: 'c.png', size: 3, mime: 'image/png', kind: 'image', url: '/attachments/room/file123/c.png',
    }),
    resolvePath: vi.fn().mockResolvedValue(null),
    deleteRoomFolder: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApp({ config, registry, admin, minter, grace, io, webhookHandler, attachments, chat });
  return { app, io };
}

describe('buildHttpServer', () => {
  it('registers exactly one "request" listener on the http server', () => {
    const { app, io } = makeAppAndIo();
    const httpServer = buildHttpServer(app, io);

    expect(httpServer.listeners('request')).toHaveLength(1);

    httpServer.close();
    io.close();
  });

  describe('round trip: socket.io handshake does not crash subsequent requests', () => {
    it('a normal request still succeeds after a socket.io polling handshake', async () => {
      const { app, io } = makeAppAndIo();
      const httpServer = buildHttpServer(app, io);

      await new Promise<void>((resolve) => httpServer.listen(0, resolve));
      const address = httpServer.address();
      if (address === null || typeof address === 'string') {
        throw new Error('expected an AddressInfo');
      }
      const port = address.port;

      // (a) plain Express route
      const first = await httpGet(`http://127.0.0.1:${port}/rooms/does-not-exist`);
      expect(first.status).toBe(404);
      expect(JSON.parse(first.body)).toEqual({ error: 'NOT_FOUND' });

      // (b) socket.io polling handshake — this is what crashed the process pre-fix.
      const handshake = await httpGet(`http://127.0.0.1:${port}/socket.io/?EIO=4&transport=polling`);
      expect(handshake.status).toBe(200);

      // (c) a normal request AFTER the handshake must still succeed — proves no
      // ERR_HTTP_HEADERS_SENT crash occurred.
      const second = await httpGet(`http://127.0.0.1:${port}/rooms/does-not-exist`);
      expect(second.status).toBe(404);
      expect(JSON.parse(second.body)).toEqual({ error: 'NOT_FOUND' });

      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      io.close();
    });
  });
});

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    }).on('error', reject);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});
