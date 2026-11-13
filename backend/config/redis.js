import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { ApiError } from '../utils/ApiError.js';

export async function createRateLimitStore(config) {
  if (!config.REDIS_URL) return { storeFactory: undefined, check: async () => {}, close: async () => {} };
  const client = createClient({ url: config.REDIS_URL, disableOfflineQueue: true,
    socket: { connectTimeout: 5000, reconnectStrategy: retries => Math.min(250 * 2 ** Math.min(retries, 5), 5000) } });
  let lastError = 0;
  client.on('error', () => {
    if (Date.now() - lastError > 30000) {
      console.error('Redis unavailable; protected request limits fail closed.');
      lastError = Date.now();
    }
  });
  let timer;
  try {
    await Promise.race([client.connect(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
    })]);
  } catch {
    if (client.isOpen) client.destroy();
    throw new Error('Unable to connect to Redis. Check REDIS_URL and network access.');
  } finally { clearTimeout(timer); }
  const command = async (...args) => {
    try {
      if (!client.isReady) throw new Error('Redis disconnected');
      return await client.sendCommand(args, { abortSignal: AbortSignal.timeout(2000) });
    } catch (error) {
      // Redis restart evicts Lua scripts; the store must recognize this and reload.
      if (/^NOSCRIPT(?:\s|$)/.test(error.message)) throw new Error('NOSCRIPT Redis script must be reloaded');
      throw new ApiError(503, 'Request limits are temporarily unavailable. Please try again.');
    }
  };
  return {
    // Preserve existing auth prefixes so deployment cannot reset active counters.
    storeFactory: name => new RedisStore({ prefix: `mit-clubs:auth:${name}:`, sendCommand: command }),
    check: async () => { await command('PING'); },
    close: async () => { if (client.isOpen) client.destroy(); },
  };
}
