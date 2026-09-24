import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import type { Config } from '../config';

/** Cliente con el JWT de la usuaria: las políticas RLS actúan como segunda barrera. */
export function createUserClient(config: Pick<Config, 'supabaseUrl' | 'supabaseAnonKey'>, token: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
    // Node < 22 no trae WebSocket nativo; la API no usa realtime pero el cliente lo inicializa.
    realtime: { transport: ws as unknown as NonNullable<NonNullable<Parameters<typeof createClient>[2]>['realtime']>['transport'] },
  });
}
