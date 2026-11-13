import { rateLimit } from 'express-rate-limit';

export function createAuthRateLimiters(storeFactory) {
  const limiter = (name, limit) => rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    ...(storeFactory ? { store: storeFactory(name) } : {}),
    message: { error: { message: 'Too many attempts. Please try again later.' } },
    // Store errors fail closed (503 via the central handler), not unlimited access.
    passOnStoreError: false,
  });
  return { signup: limiter('signup', 5), login: limiter('login', 20), refresh: limiter('refresh', 120) };
}
