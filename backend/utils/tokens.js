import { randomBytes, randomUUID, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ApiError } from './ApiError.js';

export const newRefreshToken = () => randomBytes(48).toString('base64url');
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export const validRefreshToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{64}$/.test(token);
export function createTokens(config) {
  return {
    sign(userId, sessionId) {
      return jwt.sign({ sid: sessionId, token_use: 'access' }, config.JWT_SECRET, {
        algorithm: 'HS256', subject: userId, jwtid: randomUUID(),
        issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE,
        expiresIn: config.JWT_ACCESS_TTL_SECONDS,
      });
    },
    verify(token) {
      try {
        if (typeof token !== 'string' || token.length > 4096) throw new Error('Invalid token');
        const claims = jwt.verify(token, config.JWT_SECRET, {
          algorithms: ['HS256'], issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE,
          maxAge: config.JWT_ACCESS_TTL_SECONDS,
        });
        if (typeof claims === 'string' || claims.token_use !== 'access'
          || !z.uuid().safeParse(claims.sub).success || !z.uuid().safeParse(claims.sid).success
          || typeof claims.exp !== 'number' || typeof claims.iat !== 'number'
          || claims.iat > Date.now() / 1000 + 30) throw new Error('Invalid claims');
        return claims;
      } catch { throw new ApiError(401, 'Authentication required'); }
    },
  };
}
