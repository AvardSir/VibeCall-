import type { Request, Response } from 'express';
import type { RoomRegistry } from '../../rooms.js';
import type { AttachmentService } from '../../attachments.js';
import { AppError } from '../../errors.js';

export type DownloadControllerDeps = {
  registry: Pick<RoomRegistry, 'get' | 'verifyMemberToken'>;
  attachments: Pick<AttachmentService, 'resolvePath'>;
  sendFile?: (res: Response, absolutePath: string, downloadName: string) => void;
};

export function createDownloadController(deps: DownloadControllerDeps) {
  const send = deps.sendFile ?? ((res, p, name) => { res.download(p, name); });
  return async function download(req: Request, res: Response): Promise<void> {
    const { roomName, fileId, name } = req.params as { roomName: string; fileId: string; name: string };
    if (!deps.registry.get(roomName)) throw new AppError('NOT_FOUND');
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (token === undefined || !deps.registry.verifyMemberToken(roomName, token)) throw new AppError('FORBIDDEN');
    const path = await deps.attachments.resolvePath(roomName, fileId);
    if (path === null) throw new AppError('NOT_FOUND');
    send(res, path, name);
  };
}
