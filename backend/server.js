import { parseEnv } from './config/env.js';
import { createSupabaseAdmin } from './config/supabase.js';
import { createApp } from './app.js';
import { createRateLimitStore } from './config/redis.js';

try {
  const config = parseEnv(process.env);
  const supabase = createSupabaseAdmin(config);
  const rateLimits = await createRateLimitStore(config);
  const app = createApp({ config, supabase, authStoreFactory: rateLimits.storeFactory, readinessCheck: rateLimits.check });
  console.log(`Request limits: ${config.REDIS_URL ? 'Redis (shared)' : 'in-memory (local development)'}`);
  const server = app.listen(config.PORT, config.HOST, () => {
    console.log(`MIT Clubs API listening at http://${config.HOST}:${config.PORT}`);
  });
  server.on('error', async error => {
    await rateLimits.close();
    console.error(`Server failed to listen (${error.code || 'unknown'}).`);
    process.exitCode = 1;
  });
  let closing = false;
  function shutdown(signal) {
    if (closing) return;
    closing = true;
    console.log(`${signal}: closing server`);
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async error => {
      try { await rateLimits.close(); } finally { clearTimeout(timer); process.exitCode = error ? 1 : 0; }
    });
    server.closeIdleConnections();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
