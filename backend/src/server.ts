// Load backend/.env into process.env before any config is read (no-op if absent, e.g. in prod).
import 'dotenv/config';
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { createLivekitAdmin } from './livekitAdmin.js';
import { createTokenMinter } from './livekitTokens.js';
import { createRoomRegistry } from './rooms.js';
import { createApp } from './app.js';
import { createChatService } from './chat.js';
import { createSocketServer } from './socket.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const admin = createLivekitAdmin(config);
  const minter = createTokenMinter(config);
  const registry = createRoomRegistry();
  const chat = createChatService();

  const app = createApp({ config, registry, admin, minter });
  const httpServer = createServer(app);
  createSocketServer(httpServer, { config, admin, chat });

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, 'control plane listening');
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'fatal startup error');
  process.exitCode = 1;
});
