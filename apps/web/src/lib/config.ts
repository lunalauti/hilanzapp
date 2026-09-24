export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001',
  devBypassAuth: import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true',
};

export const supabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
