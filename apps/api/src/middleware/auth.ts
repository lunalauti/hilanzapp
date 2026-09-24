import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Config } from '../config';
import { unauthorized } from '../lib/errors';
import type { AuthUser, TokenVerifier } from '../lib/jwt';
import { createUserClient } from '../lib/supabase';

export interface RequestContext {
  user: AuthUser;
  db: SupabaseClient;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}

export function requireAuth(config: Pick<Config, 'supabaseUrl' | 'supabaseAnonKey'>, verify: TokenVerifier) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const match = /^Bearer (.+)$/i.exec(header);
    if (!match) throw unauthorized();
    const token = match[1]!;
    const user = await verify(token);
    req.ctx = { user, db: createUserClient(config, token) };
    next();
  };
}

export function ctxOf(req: Request): RequestContext {
  if (!req.ctx) throw unauthorized();
  return req.ctx;
}
