import type { Request, Response } from 'express';
import type { AppConfig } from '../../config.js';
import type { LivekitAdmin } from '../../livekitAdmin.js';
import type { TokenMinter } from '../../livekitTokens.js';
import type { RoomRegistry } from '../../rooms.js';
import type { GraceService } from '../../grace.js';
import type { ChatServer } from '../../socket.js';
import { generateIdentity } from '../../identity.js';
import { AppError } from '../../errors.js';
import { emitRoomEnded, emitParticipantRemoved } from '../../socket.js';
import { parseJoinBody, parseEndBody, parseRemoveBody } from './schemeValidator.js';

export type RoomsControllerDeps = {
  config: AppConfig;
  registry: RoomRegistry;
  admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount' | 'removeParticipant' | 'deleteRoom'>;
  minter: TokenMinter;
  grace: Pick<GraceService, 'cancelGrace'>;
  io: ChatServer;
};

export type RoomsController = {
  create: (req: Request, res: Response) => Promise<void>;
  getStatus: (req: Request, res: Response) => Promise<void>;
  join: (req: Request, res: Response) => Promise<void>;
  end: (req: Request, res: Response) => Promise<void>;
  remove: (req: Request, res: Response) => Promise<void>;
};

export function createRoomsController(deps: RoomsControllerDeps): RoomsController {
  const { config, registry, admin, minter, grace, io } = deps;

  async function create(_req: Request, res: Response): Promise<void> {
    const room = registry.create();
    // Create the LiveKit room now so the first participant can connect immediately.
    await admin.ensureRoom(room.roomId);
    res.status(201).json({ roomId: room.roomId, hostToken: room.hostToken });
  }

  async function getStatus(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (typeof roomId !== 'string') throw new AppError('NOT_FOUND');
    const room = registry.get(roomId);
    if (!room) throw new AppError('NOT_FOUND');
    if (room.status === 'ended') {
      res.json({ status: 'ended' });
      return;
    }
    const count = await admin.listParticipantCount(roomId);
    res.json({ status: count >= config.maxParticipants ? 'full' : 'available' });
  }

  async function join(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (typeof roomId !== 'string') throw new AppError('NOT_FOUND');
    const room = registry.get(roomId);
    if (!room) throw new AppError('NOT_FOUND');
    if (room.status === 'ended') throw new AppError('ENDED');

    const { name, hostToken } = parseJoinBody(req.body);

    let role: 'host' | 'guest' = 'guest';
    if (hostToken !== undefined) {
      // An invalid host token is treated as a non-existent room (FR-7 error path).
      if (!registry.verifyHostToken(roomId, hostToken)) throw new AppError('NOT_FOUND');
      role = 'host';
    }

    const isHost = role === 'host';
    if (isHost && room.status === 'grace') grace.cancelGrace(roomId);

    const count = await admin.listParticipantCount(roomId);
    // While the host is in grace, reserve their slot so a guest can't take it before they return.
    const cap = !isHost && room.status === 'grace' ? config.maxParticipants - 1 : config.maxParticipants;
    if (count >= cap) throw new AppError('FULL');

    const identity = generateIdentity();
    const accessToken =
      role === 'host'
        ? await minter.mintHostToken({ identity, displayName: name, room: roomId })
        : await minter.mintGuestToken({ identity, displayName: name, room: roomId });
    if (role === 'host') registry.setHostIdentity(roomId, identity);

    const memberToken = registry.recordMemberToken(roomId, identity);

    res.json({
      accessToken,
      livekitUrl: config.livekitUrl,
      role,
      identity,
      displayName: name,
      roomId,
      memberToken,
    });
  }

  async function end(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (typeof roomId !== 'string') throw new AppError('NOT_FOUND');
    if (!registry.get(roomId)) throw new AppError('NOT_FOUND');

    const { hostToken } = parseEndBody(req.body);
    if (!registry.verifyHostToken(roomId, hostToken)) throw new AppError('NOT_FOUND');

    // Flag the room as intentionally ending first, so the host-left webhook that LiveKit fires
    // during teardown is recognized as expected and doesn't start a grace countdown.
    registry.setStatus(roomId, 'ending');
    emitRoomEnded(io, roomId, 'host_ended'); // tell guests before teardown
    await admin.deleteRoom(roomId);
    registry.markEnded(roomId);
    res.sendStatus(204);
  }

  async function remove(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (typeof roomId !== 'string') throw new AppError('NOT_FOUND');
    if (!registry.get(roomId)) throw new AppError('NOT_FOUND');

    const { hostToken, targetIdentity } = parseRemoveBody(req.body);
    if (!registry.verifyHostToken(roomId, hostToken)) throw new AppError('NOT_FOUND');

    emitParticipantRemoved(io, roomId, targetIdentity); // guest learns the reason before the kick
    await admin.removeParticipant(roomId, targetIdentity);
    res.sendStatus(204);
  }

  return { create, getStatus, join, end, remove };
}
