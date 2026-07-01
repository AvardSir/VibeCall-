import express from 'express';
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import multer from 'multer';
import { StatusCodes } from 'http-status-codes';
import type { AppConfig } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { TokenMinter } from './livekitTokens.js';
import type { RoomRegistry } from './rooms.js';
import type { GraceService } from './grace.js';
import type { ChatServer } from './socket.js';
import type { AttachmentService } from './attachments.js';
import type { ChatService } from './chat.js';
import { AppError } from './errors.js';
import type { ErrorCode } from './errors.js';
import { logger } from './logger.js';
import { createRootRouter } from './routes/index.js';

export type AppDeps = {
  config: AppConfig;
  registry: RoomRegistry;
  admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount' | 'removeParticipant' | 'deleteRoom'>;
  minter: TokenMinter;
  grace: Pick<GraceService, 'cancelGrace'>;
  io: ChatServer;
  webhookHandler: RequestHandler;
  attachments: Pick<AttachmentService, 'validateAndStore' | 'resolvePath' | 'deleteRoomFolder'>;
  chat: Pick<ChatService, 'clear'>;
};

export function createApp(deps: AppDeps): Express {
  const { config } = deps;
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));

  // Mounted BEFORE express.json(): the LiveKit WebhookReceiver verifies its signature over the
  // raw request body, so express.json() must not parse/consume it first.
  app.post('/webhooks/livekit', express.raw({ type: '*/*' }), deps.webhookHandler);
  app.use(express.json());

  app.use(createRootRouter(deps));

  // Error edge middleware: maps AppError → {status, {error: code}}; unknown → 500.
  // The 4-argument signature is required for Express to recognise this as an error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // Multer's own file-size guard rejects before our validateAndStore ever runs (it throws
    // synchronously into Express's error pipeline) — map it onto the same FILE_TOO_LARGE
    // contract as attachments.ts so callers see one consistent 413 shape either way.
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(StatusCodes.REQUEST_TOO_LONG).json({ error: 'FILE_TOO_LARGE' });
      return;
    }
    if (err instanceof AppError) {
      const code: ErrorCode = err.code;
      res.status(err.status).json({ error: code });
      return;
    }
    logger.error({ err }, 'unhandled error in request');
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'INTERNAL' });
  });

  return app;
}
