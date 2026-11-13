import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
import { newRefreshToken, hashToken, validRefreshToken, createTokens } from '../utils/tokens.js';

const hashOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
// Missing users still perform password verification; no plaintext/password logging.
const dummyHash = argon2.hash('dummy-account-'+randomUUID(), hashOptions);
export const safeUser = user => ({
  id: user.id, email: user.email, full_name: user.full_name,
  year_group_id: user.year_group_id, email_verified_at: user.email_verified_at,
});
function databaseError(error) {
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return new ApiError(503, 'Authentication setup is incomplete. Please contact the administrator.');
  }
  return new ApiError(503, 'Authentication is temporarily unavailable');
}
export function createAuthService(supabase, config) {
  const tokens = createTokens(config);
  const expiry = () => new Date(Date.now() + (config.AUTH_SESSION_DAYS ?? 30) * 86400000).toISOString();
  const response = (user, sessionId, refreshToken, expiresAt) => ({
    user: safeUser(user), accessToken: tokens.sign(user.id, sessionId),
    expiresIn: config.JWT_ACCESS_TTL_SECONDS, refreshToken, expiresAt,
  });
  return {
    async signup({ email, password, full_name, year_group_id }) {
      const passwordHash = await argon2.hash(password, hashOptions);
      const sessionId = randomUUID(), refreshToken = newRefreshToken(), expiresAt = expiry();
      const { data, error } = await supabase.rpc('auth_create_account', {
        p_email: email, p_password_hash: passwordHash, p_full_name: full_name,
        p_year_group_id: year_group_id ?? null, p_session_id: sessionId,
        p_refresh_hash: hashToken(refreshToken), p_expires_at: expiresAt,
      });
      if (error?.code === '23505') throw new ApiError(409, 'Unable to create an account with those details');
      if (error) throw databaseError(error);
      return response(data, sessionId, refreshToken, expiresAt);
    },
    async login({ email, password }) {
      const { data: user, error } = await supabase.from('users')
        .select('id,email,password_hash,full_name,year_group_id,email_verified_at,disabled_at')
        .eq('email', email).maybeSingle();
      if (error) throw databaseError(error);
      const matches = await argon2.verify(user?.password_hash ?? await dummyHash, password);
      if (!user || !matches || user.disabled_at) throw new ApiError(401, 'Invalid email or password');
      const sessionId = randomUUID(), refreshToken = newRefreshToken(), expiresAt = expiry();
      const { data, error: sessionError } = await supabase.rpc('auth_create_session', {
        p_user_id: user.id, p_expected_password_hash: user.password_hash,
        p_session_id: sessionId, p_refresh_hash: hashToken(refreshToken), p_expires_at: expiresAt,
      });
      if (sessionError) throw databaseError(sessionError);
      if (!data) throw new ApiError(401, 'Invalid email or password');
      return response(user, sessionId, refreshToken, expiresAt);
    },
    async refresh(oldToken) {
      if (!validRefreshToken(oldToken)) throw new ApiError(401, 'Please sign in again');
      const refreshToken = newRefreshToken();
      const { data, error } = await supabase.rpc('auth_rotate_refresh', {
        p_old_hash: hashToken(oldToken), p_new_hash: hashToken(refreshToken),
      });
      if (error) throw databaseError(error);
      if (data.status !== 'ok') throw new ApiError(401, 'Please sign in again');
      return response(data.user, data.session_id, refreshToken, data.expires_at);
    },
    async logout(token) {
      if (!validRefreshToken(token)) return;
      const { error } = await supabase.rpc('auth_revoke_refresh', { p_token_hash: hashToken(token) });
      if (error) throw databaseError(error);
    },
    async logoutAll(userId) {
      const { error } = await supabase.from('auth_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) throw databaseError(error);
    },
    async roles(userId) {
      const [admin, managers, projects] = await Promise.all([
        supabase.from('app_admins').select('user_id').eq('user_id', userId).maybeSingle(),
        supabase.from('club_managers').select('club_id').eq('user_id', userId),
        supabase.from('project_managers').select('project_id').eq('user_id', userId),
      ]);
      if (admin.error || managers.error || projects.error) throw databaseError(admin.error || managers.error || projects.error);
      return { is_admin: Boolean(admin.data), managed_club_ids: managers.data.map(row => row.club_id), managed_project_ids: projects.data.map(row => row.project_id) };
    },
  };
}
