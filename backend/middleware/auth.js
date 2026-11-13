import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { createTokens } from '../utils/tokens.js';
import { safeUser } from '../service/authService.js';

export function createAuthMiddleware(supabase, config) {
  const tokens = createTokens(config);
  const requireAuth = async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.get('Authorization') ?? '');
    if (!match) throw new ApiError(401, 'Authentication required');
    const claims = tokens.verify(match[1]);
    const { data: session, error } = await supabase.from('auth_sessions')
      .select('id,user_id,expires_at,revoked_at,user:users(id,email,full_name,year_group_id,email_verified_at,disabled_at)')
      .eq('id', claims.sid).eq('user_id', claims.sub).maybeSingle();
    if (error) throw new ApiError(503, 'Authentication is temporarily unavailable');
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()
      || !session.user || session.user.disabled_at) throw new ApiError(401, 'Authentication required');
    req.auth = { sessionId: session.id, user: safeUser(session.user) };
    next();
  };
  const isAdmin = async userId => {
    const { data, error } = await supabase.from('app_admins').select('user_id').eq('user_id', userId).maybeSingle();
    if (error) throw new ApiError(503, 'Authorization is temporarily unavailable');
    return Boolean(data);
  };
  const requireAdmin = async (req, res, next) => {
    if (!req.auth) throw new ApiError(401, 'Authentication required');
    if (!await isAdmin(req.auth.user.id)) throw new ApiError(403, 'Administrator access required');
    next();
  };
  const requireClubManager = async (req, res, next) => {
    if (!req.auth) throw new ApiError(401, 'Authentication required');
    if (!z.uuid().safeParse(req.params.clubId).success) throw new ApiError(400, 'Invalid club ID');
    if (await isAdmin(req.auth.user.id)) return next();
    const { data, error } = await supabase.from('club_managers').select('club_id')
      .eq('club_id', req.params.clubId).eq('user_id', req.auth.user.id).maybeSingle();
    if (error) throw new ApiError(503, 'Authorization is temporarily unavailable');
    if (!data) throw new ApiError(403, 'Club manager access required');
    next();
  };
  return { requireAuth, requireAdmin, requireClubManager };
}

// Custom header prevents simple cross-site form submissions; Origin validation
// also rejects untrusted same-site sibling origins. Cookies alone never suffice.
export function authWriteGuard(config) {
  return (req, res, next) => {
    const origin = req.get('Origin');
    if ((origin && !config.CORS_ORIGINS.includes(origin)) || req.get('X-Requested-With') !== 'mit-clubs-web') {
      throw new ApiError(403, 'Invalid authentication request');
    }
    next();
  };
}
