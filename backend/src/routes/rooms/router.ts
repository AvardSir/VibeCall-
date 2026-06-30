import { Router } from 'express';
import { asyncHandler } from '../../asyncHandler.js';
import { createRoomsController } from './controller.js';
import type { RoomsControllerDeps } from './controller.js';

// Routes under the `/rooms` mount: room status and guest join.
export function createRoomsRouter(deps: RoomsControllerDeps): Router {
  const controller = createRoomsController(deps);
  const router = Router();
  router.get('/:roomName', asyncHandler(controller.getStatus));
  router.post('/:roomName/join', asyncHandler(controller.join));
  return router;
}
