import type { Request, Response } from 'express';
import type { AppConfig } from '../../config.js';
import type { LivekitAdmin } from '../../livekitAdmin.js';
import type { TokenMinter } from '../../livekitTokens.js';
import type { RoomRegistry } from '../../rooms.js';
import { generateIdentity } from '../../identity.js';
import { AppError } from '../../errors.js';
import { parseJoinBody } from './schemeValidator.js';

export type RoomsControllerDeps = {
  config: AppConfig;
  registry: RoomRegistry;
  admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount'>;
  minter: TokenMinter;
};

export type RoomsController = {
  create: (req: Request, res: Response) => Promise<void>;
  getStatus: (req: Request, res: Response) => Promise<void>;
  join: (req: Request, res: Response) => Promise<void>;
};

export function createRoomsController(deps: RoomsControllerDeps): RoomsController {
  const { config, registry, admin, minter } = deps;

  async function create(_req: Request, res: Response): Promise<void> {
    const room = registry.create();
    // Create the LiveKit room now so the first participant can connect immediately.
    await admin.ensureRoom(room.roomId);
    res.status(201).json({ roomId: room.roomId, hostToken: room.hostToken });
  }

  async function getStatus(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (!registry.get(roomId)) throw new AppError('NOT_FOUND');
    const count = await admin.listParticipantCount(roomId);
    res.json({ status: count >= config.maxParticipants ? 'full' : 'available' });
  }

  async function join(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (!registry.get(roomId)) throw new AppError('NOT_FOUND');

    const { name, hostToken } = parseJoinBody(req.body);

    let role: 'host' | 'guest' = 'guest';
    if (hostToken !== undefined) {
      // An invalid host token is treated as a non-existent room (FR-7 error path).
      if (!registry.verifyHostToken(roomId, hostToken)) throw new AppError('NOT_FOUND');
      role = 'host';
    }

    const count = await admin.listParticipantCount(roomId);
    if (count >= config.maxParticipants) throw new AppError('FULL');

    const identity = generateIdentity();
    const accessToken =
      role === 'host'
        ? await minter.mintHostToken({ identity, displayName: name, room: roomId })
        : await minter.mintGuestToken({ identity, displayName: name, room: roomId });
    if (role === 'host') registry.setHostIdentity(roomId, identity);

    res.json({
      accessToken,
      livekitUrl: config.livekitUrl,
      role,
      identity,
      displayName: name,
      roomId,
    });
  }

  return { create, getStatus, join };
}
