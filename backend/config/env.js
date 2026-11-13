import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Resolve relative to this module so startup works from either project directory.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(value => value.split(',').map(v => v.trim()).filter(Boolean))
    .pipe(z.array(z.url().refine(value => new URL(value).origin === value, 'Use an origin without path or trailing slash')).min(1)),
  SUPABASE_URL: z.url().refine(value => new URL(value).protocol === 'https:', 'Use the HTTPS Supabase project URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).refine(value => !value.startsWith('replace-'), 'Replace the example key'),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('assets'),
  JWT_SECRET: z.string().min(32).refine(value => !value.startsWith('replace-'), 'Generate your own JWT secret'),
  REDIS_URL: z.url().refine(value => ['redis:', 'rediss:'].includes(new URL(value).protocol), 'Use redis:// or rediss://').optional(),
  AUTH_SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(30),
  AUTH_COOKIE_SECURE: z.enum(['true', 'false']).optional().transform(value => value === undefined ? undefined : value === 'true'),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  JWT_ISSUER: z.string().min(1).default('mit-clubs-api'),
  JWT_AUDIENCE: z.string().min(1).default('mit-clubs-web'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && !value.REDIS_URL) ctx.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'Required in production for shared auth rate limits' });
  if ((value.NODE_ENV === 'production' && value.AUTH_COOKIE_SECURE === false) || (value.AUTH_COOKIE_SAME_SITE === 'none' && !(value.AUTH_COOKIE_SECURE ?? value.NODE_ENV === 'production'))) {
    ctx.addIssue({ code: 'custom', path: ['AUTH_COOKIE_SECURE'], message: 'Secure cookies are required for production or SameSite=None' });
  }
});

export function parseEnv(input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Report variable names and reasons, never submitted secret values.
    const problems = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid backend environment:\n${problems.join('\n')}`);
  }
  return result.data;
}
