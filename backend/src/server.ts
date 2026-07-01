// Load backend/.env into process.env before any config is read (no-op if absent, e.g. in prod).
import 'dotenv/config';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import type { Express } from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { loadConfig, MAX_ATTACHMENT_BYTES } from './config.js';
import { createLivekitAdmin } from './livekitAdmin.js';
import { createTokenMinter } from './livekitTokens.js';
import { createRoomRegistry } from './rooms.js';
import { createApp } from './app.js';
import { createChatService } from './chat.js';
import { createAttachmentService } from './attachments.js';
import { createSocketServer, emitGraceTick, emitGraceCancelled, emitRoomEnded } from './socket.js';
import type { ChatServer } from './socket.js';
import { createGraceService } from './grace.js';
import { createWebhookHandler } from './webhooks.js';
import { logger } from './logger.js';

// Express is the base request handler; Socket.IO is then attached to the http server so it can
// intercept `/socket.io/...` requests and delegate everything else to `app`. Building the plain
// http server around `app` first (`createServer(app)`) and calling `io.attach(httpServer)`
// afterwards ensures Socket.IO's internal request listener is the ONLY listener registered on
// the server — it snapshots `app` as its fallback handler. Doing this in the other order (bare
// httpServer, then `new Server(httpServer)`, then `httpServer.on('request', app)`) leaves TWO
// independent 'request' listeners registered, and both fire on every request — for a
// `/socket.io/...` handshake that crashes the process with ERR_HTTP_HEADERS_SENT once Express
// also tries to write a response after engine.io already has.
export function buildHttpServer(app: Express, io: ChatServer): HttpServer {
  const httpServer = createServer(app);
  io.attach(httpServer);
  return httpServer;
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const admin = createLivekitAdmin(config);
  const minter = createTokenMinter(config);
  const registry = createRoomRegistry();
  const chat = createChatService();
  // Minimal construction for Task 7 (upload endpoint wiring); Task 9 adds the orphan sweep and
  // any teardown/lifecycle hooks around this service.
  const attachments = createAttachmentService({
    storageRoot: config.attachmentStoragePath,
    maxBytes: MAX_ATTACHMENT_BYTES,
  });

  // `io` and `grace` reference each other (grace broadcasts over `io`; `end`/`remove` cancel
  // grace over the same `io`), so `io` is created first (detached from any http server), then
  // handed to the grace service, and both are passed into the Express app afterwards.
  const io: ChatServer = createSocketServer({ config, admin, chat });
  const grace = createGraceService({
    registry,
    admin,
    graceSeconds: config.graceTimeoutSeconds,
    onTick: (roomId, secondsLeft) => emitGraceTick(io, roomId, secondsLeft),
    onCancelled: (roomId) => emitGraceCancelled(io, roomId),
    onEnded: (roomId, reason) => emitRoomEnded(io, roomId, reason),
  });

  const receiver = new WebhookReceiver(config.livekitApiKey, config.livekitApiSecret);
  const webhookHandler = createWebhookHandler({ receiver, registry, grace });

  const app = createApp({ config, registry, admin, minter, grace, io, webhookHandler, attachments });
  const httpServer = buildHttpServer(app, io);

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, 'control plane listening');
  });
}

// Only start the server when this module is run directly (e.g. `node dist/server.js` /
// `tsx watch src/server.ts`), not when it is imported (e.g. by server.test.ts for
// `buildHttpServer`) — importing must not have the side effect of binding a port.
// `pathToFileURL` (not a raw `file://${...}` template) normalizes Windows path separators and
// encoding so the comparison works cross-platform.
const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((err: unknown) => {
    logger.error({ err }, 'fatal startup error');
    process.exitCode = 1;
  });
}
