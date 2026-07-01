// Load backend/.env into process.env before any config is read (no-op if absent, e.g. in prod).
import 'dotenv/config';
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { createLivekitAdmin } from './livekitAdmin.js';
import { createTokenMinter } from './livekitTokens.js';
import { createRoomRegistry } from './rooms.js';
import { createApp } from './app.js';
import { createChatService } from './chat.js';
import { createSocketServer, emitGraceTick, emitGraceCancelled, emitRoomEnded } from './socket.js';
import type { ChatServer } from './socket.js';
import { createGraceService } from './grace.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const admin = createLivekitAdmin(config);
  const minter = createTokenMinter(config);
  const registry = createRoomRegistry();
  const chat = createChatService();

  // `io` and `grace` reference each other (grace broadcasts over `io`; `end`/`remove` cancel
  // grace over the same `io`), so `io` is created first against a bare httpServer, then handed
  // to the grace service, and both are passed into the Express app afterwards.
  const httpServer = createServer();
  const io: ChatServer = createSocketServer(httpServer, { config, admin, chat });
  const grace = createGraceService({
    registry,
    admin,
    graceSeconds: config.graceTimeoutSeconds,
    onTick: (roomId, secondsLeft) => emitGraceTick(io, roomId, secondsLeft),
    onCancelled: (roomId) => emitGraceCancelled(io, roomId),
    onEnded: (roomId, reason) => emitRoomEnded(io, roomId, reason),
  });

  const app = createApp({ config, registry, admin, minter, grace, io });
  httpServer.on('request', app);

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, 'control plane listening');
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'fatal startup error');
  process.exitCode = 1;
});
