import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { RoomRegistry } from '../../rooms.js';
import type { AttachmentService } from '../../attachments.js';
import { AppError } from '../../errors.js';

export type UploadControllerDeps = {
  registry: Pick<RoomRegistry, 'get' | 'verifyMemberToken'>;
  attachments: Pick<AttachmentService, 'validateAndStore'>;
};

export function createUploadController(deps: UploadControllerDeps): (req: Request, res: Response) => Promise<void> {
  return async function upload(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (typeof roomId !== 'string' || !deps.registry.get(roomId)) throw new AppError('NOT_FOUND');
    const token = req.header('x-member-token');
    if (token === undefined || !deps.registry.verifyMemberToken(roomId, token)) throw new AppError('FORBIDDEN');
    const { file } = req;
    if (!file) throw new AppError('UNSUPPORTED_TYPE');
    const attachment = await deps.attachments.validateAndStore({
      roomName: roomId, originalName: file.originalname, mime: file.mimetype, buffer: file.buffer,
    });
    res.status(StatusCodes.CREATED).json(attachment);
  };
}
