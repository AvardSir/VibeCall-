import { Router } from 'express';
import { createRoomsRouter } from './rooms/router.js';
import type { RoomsControllerDeps } from './rooms/controller.js';
import { createUploadRouter } from './attachments/router.js';
import type { UploadControllerDeps } from './attachments/uploadController.js';
import { createDownloadRouter } from './attachments/downloadRouter.js';
import type { DownloadControllerDeps } from './attachments/downloadController.js';

export type RootRouterDeps = RoomsControllerDeps & UploadControllerDeps & DownloadControllerDeps;

// Composition of all feature routers. Add further feature routers here as the API grows.
export function createRootRouter(deps: RootRouterDeps): Router {
  const router = Router();
  router.use('/rooms', createRoomsRouter(deps));
  router.use('/rooms', createUploadRouter(deps));
  // Mounted at the root (NOT under `/rooms`) so the path matches the attachment `url` shape:
  // `/attachments/:roomName/:fileId/:name`.
  router.use(createDownloadRouter(deps));
  return router;
}
