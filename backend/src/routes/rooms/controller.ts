import type { Request, Response } from 'express';
import type { AppConfig } from '../../config.js';
import type { LivekitAdmin } from '../../livekitAdmin.js';
import type { TokenMinter } from '../../livekitTokens.js';
import { generateIdentity } from '../../identity.js';
import { AppError } from '../../errors.js';
import { parseJoinBody } from './schemeValidator.js';

export type RoomsControllerDeps = {
  config: AppConfig;
  admin: Pick<LivekitAdmin, 'listParticipantCount'>;
  minter: TokenMinter;
};

export type RoomsController = {
  getStatus: (req: Request, res: Response) => Promise<void>;
  join: (req: Request, res: Response) => Promise<void>;
};

export function createRoomsController(deps: RoomsControllerDeps): RoomsController {
  const { config, admin, minter } = deps;

  async function getStatus(_req: Request, res: Response): Promise<void> {
    const count = await admin.listParticipantCount();
    res.json({ status: count >= config.maxParticipants ? 'full' : 'available' });
  }

  async function join(req: Request, res: Response): Promise<void> {
    const count = await admin.listParticipantCount();
    if (count >= config.maxParticipants) throw new AppError('FULL');

    const { name } = parseJoinBody(req.body);
    const identity = generateIdentity();
    const accessToken = await minter.mintGuestToken({
      identity,
      displayName: name,
      room: config.fixedRoomName,
    });

    res.json({
      accessToken,
      livekitUrl: config.livekitUrl,
      role: 'guest' as const,
      identity,
      displayName: name,
    });
  }

  return { getStatus, join };
}
