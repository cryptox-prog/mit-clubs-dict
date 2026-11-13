import { Router } from 'express';
import { createAuthController } from '../controller/authController.js';
import { createAuthMiddleware, authWriteGuard } from '../middleware/auth.js';
import { createAuthRateLimiters } from '../middleware/authRateLimit.js';

export function createAuthRouter(supabase, config, storeFactory) {
  const router = Router();
  const controller = createAuthController(supabase, config);
  const { requireAuth } = createAuthMiddleware(supabase, config);
  const limits = createAuthRateLimiters(storeFactory);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/me', requireAuth, controller.me);
  router.use(authWriteGuard(config));
  router.post('/signup', limits.signup, controller.signup);
  router.post('/login', limits.login, controller.login);
  router.post('/refresh', limits.refresh, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', requireAuth, controller.logoutAll);
  return router;
}
