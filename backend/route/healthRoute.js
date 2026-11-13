import { Router } from 'express';
import { createHealthController } from '../controller/healthController.js';

export function createHealthRouter(supabase, readinessCheck) {
  const router = Router();
  const health = createHealthController(supabase, readinessCheck);
  router.get('/', health.live);
  router.get('/ready', health.ready);
  return router;
}
