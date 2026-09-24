import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, supabaseConfigured } from './config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  client ??= createClient(config.supabaseUrl!, config.supabaseAnonKey!);
  return client;
}
