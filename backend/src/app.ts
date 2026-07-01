import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { StatusCodes } from 'http-status-codes';
import type { AppConfig } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { TokenMinter } from './livekitTokens.js';
import type { RoomRegistry } from './rooms.js';
import type { GraceService } from './grace.js';
import type { ChatServer } from './socket.js';
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
};

export function createApp(deps: AppDeps): Express {
  const { config } = deps;
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.use(createRootRouter(deps));

  // Error edge middleware: maps AppError → {status, {error: code}}; unknown → 500.
  // The 4-argument signature is required for Express to recognise this as an error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
