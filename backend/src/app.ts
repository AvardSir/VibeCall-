import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { AppConfig } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { TokenMinter } from './livekitTokens.js';
import { validateDisplayName } from './validation.js';
import { generateIdentity } from './identity.js';
import { AppError } from './errors.js';
import type { ErrorCode } from './errors.js';
import { logger } from './logger.js';

export type AppDeps = {
  config: AppConfig;
  admin: Pick<LivekitAdmin, 'listParticipantCount'>;
  minter: TokenMinter;
};

export function createApp(deps: AppDeps): Express {
  const { config, admin, minter } = deps;
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/rooms/:roomName', (req: Request, res: Response, next: NextFunction) => {
    void handleStatus(req, res).catch(next);
  });

  app.post('/rooms/:roomName/join', (req: Request, res: Response, next: NextFunction) => {
    void handleJoin(req, res).catch(next);
  });

  async function handleStatus(_req: Request, res: Response): Promise<void> {
    const count = await admin.listParticipantCount();
    res.json({ status: count >= config.maxParticipants ? 'full' : 'available' });
  }

  async function handleJoin(req: Request, res: Response): Promise<void> {
    const count = await admin.listParticipantCount();
    if (count >= config.maxParticipants) throw new AppError('FULL');

    const nameResult = validateDisplayName((req.body as { name?: unknown }).name);
    if (!nameResult.ok) throw new AppError('INVALID_NAME');

    const identity = generateIdentity();
    const accessToken = await minter.mintGuestToken({
      identity,
      displayName: nameResult.value,
      room: config.fixedRoomName,
    });

    res.json({
      accessToken,
      livekitUrl: config.livekitUrl,
      role: 'guest' as const,
      identity,
      displayName: nameResult.value,
    });
  }

  // Error edge middleware: maps AppError → {status, {error: code}}; unknown → 500.
  // The 4-argument signature is required for Express to recognise this as an error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      const code: ErrorCode = err.code;
      res.status(err.status).json({ error: code });
      return;
    }
    logger.error({ err }, 'unhandled error in request');
    res.status(500).json({ error: 'INTERNAL' });
  });

  return app;
}
