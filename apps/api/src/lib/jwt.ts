import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Config } from '../config';
import { unauthorized } from './errors';

export interface AuthUser {
  id: string;
  email?: string;
}

export type TokenVerifier = (token: string) => Promise<AuthUser>;

/** Verifica el JWT de Supabase: con el secreto HS256 si existe, o con el JWKS del proyecto. */
export function createTokenVerifier(config: Pick<Config, 'supabaseUrl' | 'supabaseJwtSecret'>): TokenVerifier {
  const issuer = `${config.supabaseUrl}/auth/v1`;
  const secret = config.supabaseJwtSecret ? new TextEncoder().encode(config.supabaseJwtSecret) : null;
  const jwks = secret ? null : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    try {
      const options = { issuer, audience: 'authenticated' };
      const { payload } = secret ? await jwtVerify(token, secret, options) : await jwtVerify(token, jwks!, options);
      if (!payload.sub) throw new Error('sin sub');
      return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
    } catch {
      throw unauthorized('Sesión inválida o vencida');
    }
  };
}
