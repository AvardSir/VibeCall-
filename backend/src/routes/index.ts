import { Router } from 'express';
import { createRoomsRouter } from './rooms/router.js';
import type { RoomsControllerDeps } from './rooms/controller.js';
import { createUploadRouter } from './attachments/router.js';
import type { UploadControllerDeps } from './attachments/uploadController.js';

export type RootRouterDeps = RoomsControllerDeps & UploadControllerDeps;

// Composition of all feature routers. Add further feature routers here as the API grows.
export function createRootRouter(deps: RootRouterDeps): Router {
  const router = Router();
  router.use('/rooms', createRoomsRouter(deps));
  router.use('/rooms', createUploadRouter(deps));
  return router;
}
