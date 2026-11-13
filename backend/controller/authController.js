import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { createAuthService } from '../service/authService.js';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(12).max(128);
const signupSchema = z.object({
  email, password, full_name: z.string().trim().min(1).max(150),
  year_group_id: z.number().int().min(1).max(4).nullable().optional(),
}).strict();
const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
function validate(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, schema === signupSchema
    ? 'Provide a name, valid email, password of 12–128 characters, and an optional year from 1 to 4'
    : 'Provide a valid email and password');
  return parsed.data;
}
export function createAuthController(supabase, config) {
  const auth = createAuthService(supabase, config);
  const secure = config.AUTH_COOKIE_SECURE ?? config.NODE_ENV === 'production';
  const name = secure ? '__Secure-mit_refresh' : 'mit_refresh';
  const cookieOptions = { httpOnly: true, secure, sameSite: config.AUTH_COOKIE_SAME_SITE ?? 'lax', path: '/api/auth' };
  function clear(res) { res.clearCookie(name, cookieOptions); }
  function sendSession(res, session, status = 200) {
    res.cookie(name, session.refreshToken, { ...cookieOptions, expires: new Date(session.expiresAt) });
    // Do not return the raw refresh token or any password/session database fields.
    res.status(status).json({ user: session.user, accessToken: session.accessToken, expiresIn: session.expiresIn });
  }
  return {
    signup: async (req, res) => sendSession(res, await auth.signup(validate(signupSchema, req.body)), 201),
    login: async (req, res) => sendSession(res, await auth.login(validate(loginSchema, req.body))),
    refresh: async (req, res) => {
      try { sendSession(res, await auth.refresh(req.cookies[name])); }
      catch (error) { if (error.statusCode === 401) clear(res); throw error; }
    },
    logout: async (req, res) => { await auth.logout(req.cookies[name]); clear(res); res.status(204).end(); },
    logoutAll: async (req, res) => { await auth.logoutAll(req.auth.user.id); clear(res); res.status(204).end(); },
    me: async (req, res) => res.json({ user: { ...req.auth.user, ...await auth.roles(req.auth.user.id) } }),
  };
}
