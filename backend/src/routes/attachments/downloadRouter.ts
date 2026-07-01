import { Router } from 'express';
import { asyncHandler } from '../../asyncHandler.js';
import { createDownloadController } from './downloadController.js';
import type { DownloadControllerDeps } from './downloadController.js';

// Mounted at the app ROOT (not under `/rooms`) so the resulting path matches the `url` shape
// returned by AttachmentService.validateAndStore: `/attachments/:roomName/:fileId/:name`.
export function createDownloadRouter(deps: DownloadControllerDeps): Router {
  const router = Router();
  router.get('/attachments/:roomName/:fileId/:name', asyncHandler(createDownloadController(deps)));
  return router;
}
