import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { createAuthMiddleware, authWriteGuard } from '../middleware/auth.js';
import { createManagementController } from '../controller/managementController.js';

export function createManagementRouter(supabase, config, storeFactory) {
  const router = Router();
  const { requireAuth, requireAdmin } = createAuthMiddleware(supabase, config);
  const controller = createManagementController(supabase, config);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024, files: 1, fields: 1, parts: 2 },
    fileFilter(req,file,done) { done(null, ['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(file.mimetype)); },
  });
  router.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  router.use(requireAuth);
  router.get('/access', controller.access);
  router.get('/dashboard', controller.dashboard);
  router.get('/:kind/:id/managers', requireAdmin, controller.assignments);
  router.use(authWriteGuard(config));
  router.use(rateLimit({ windowMs: 15*60*1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    ...(storeFactory ? { store: storeFactory('management') } : {}),
    message: { error: { message: 'Too many changes. Please try again later.' } },
  }));
  router.put('/:kind/:id/managers', requireAdmin, controller.assign);
  router.patch('/:kind/:id', controller.authorize, controller.update);
  router.post('/:kind/:id/icon', controller.authorize, upload.single('icon'), controller.icon);
  return router;
}
