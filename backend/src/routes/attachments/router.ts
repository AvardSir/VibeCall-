import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../asyncHandler.js';
import { createUploadController } from './uploadController.js';
import type { UploadControllerDeps } from './uploadController.js';
import { MAX_ATTACHMENT_BYTES } from '../../config.js';

export function createUploadRouter(deps: UploadControllerDeps): Router {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } });
  const router = Router();
  router.post('/:roomId/attachments', upload.single('file'), asyncHandler(createUploadController(deps)));
  return router;
}
