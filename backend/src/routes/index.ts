import { Router } from 'express';
import { createRoomsRouter } from './rooms/router.js';
import type { RoomsControllerDeps } from './rooms/controller.js';

// Composition of all feature routers. Add further feature routers here as the API grows.
export function createRootRouter(deps: RoomsControllerDeps): Router {
  const router = Router();
  router.use('/rooms', createRoomsRouter(deps));
  return router;
}
