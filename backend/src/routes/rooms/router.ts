import { Router } from 'express';
import { asyncHandler } from '../../asyncHandler.js';
import { createRoomsController } from './controller.js';
import type { RoomsControllerDeps } from './controller.js';

// Routes under the `/rooms` mount: create a room, query status, and join (guest or host).
export function createRoomsRouter(deps: RoomsControllerDeps): Router {
  const controller = createRoomsController(deps);
  const router = Router();
  router.post('/', asyncHandler(controller.create));
  router.get('/:roomId', asyncHandler(controller.getStatus));
  router.post('/:roomId/join', asyncHandler(controller.join));
  return router;
}
