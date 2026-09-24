import { config } from './config';
import { createApiClient } from './api';
import { getSupabase } from './supabase';

export const api = createApiClient(config.apiUrl, async () => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});
