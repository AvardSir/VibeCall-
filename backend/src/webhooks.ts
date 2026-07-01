import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { WebhookEvent } from 'livekit-server-sdk';
import type { RoomRegistry } from './rooms.js';
import type { GraceService } from './grace.js';
import { logger } from './logger.js';

export type WebhookDeps = {
  receiver: { receive(body: string, auth: string | undefined): Promise<WebhookEvent> };
  registry: Pick<RoomRegistry, 'get' | 'clearShare'>;
  grace: Pick<GraceService, 'startGrace'>;
  onShareCleared: (roomName: string) => void;
};

export function createWebhookHandler(deps: WebhookDeps): RequestHandler {
  return async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    let event: WebhookEvent;
    try {
      // req.body is a raw string/Buffer (express.raw()); receiver verifies the LiveKit signature.
      event = await deps.receiver.receive(req.body as string, req.header('Authorization'));
    } catch (err: unknown) {
      logger.error({ err }, 'webhook signature verification failed');
      res.sendStatus(401);
      return;
    }
    if (event.event === 'participant_left') {
      const roomId = event.room?.name;
      const identity = event.participant?.identity;
      const room = roomId !== undefined ? deps.registry.get(roomId) : undefined;
      if (room && room.activeSharerId === identity) {
        if (deps.registry.clearShare(room.roomId)) deps.onShareCleared(room.roomId);
      }
      if (room && identity === room.hostIdentity && room.status === 'active') {
        if (deps.registry.clearShare(room.roomId)) deps.onShareCleared(room.roomId); // grace force-clears any active share
        deps.grace.startGrace(room.roomId);
      }
    }
    res.sendStatus(200);
  };
}
