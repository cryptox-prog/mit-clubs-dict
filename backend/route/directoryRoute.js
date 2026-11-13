import { Router } from 'express';
import { createDirectoryController } from '../controller/directoryController.js';
import { directoryResources } from '../service/directoryService.js';
import { rateLimit } from 'express-rate-limit';

export function createDirectoryRouter(supabase, bucket, storeFactory) {
  const router = Router();
  const controller = createDirectoryController(supabase, bucket);
  const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600,
    standardHeaders: 'draft-8', legacyHeaders: false, passOnStoreError: false,
    ...(storeFactory ? { store: storeFactory('directory') } : {}),
    message: { error: { message: 'Too many directory requests. Please try again later.' } },
  });
  for (const route of Object.keys(directoryResources)) {
    router.get(`/${route}`, limit, controller.list(route));
    router.get(`/${route}/:id/icon`, limit, controller.icon(route));
  }
  return router;
}
