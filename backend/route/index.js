import { Router } from 'express';
import { createHealthRouter } from './healthRoute.js';
import { createDirectoryRouter } from './directoryRoute.js';

export function createApiRouter(supabase, bucket = 'assets', storeFactory, readinessCheck) {
  const router = Router();
  router.use('/health', createHealthRouter(supabase, readinessCheck));
  router.use(createDirectoryRouter(supabase, bucket, storeFactory));
  return router;
}
