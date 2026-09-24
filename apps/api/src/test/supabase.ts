import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { createApp } from '../app';
import { loadConfig } from '../config';

// Valores públicos y fijos del Supabase local de desarrollo (`supabase start`); no son secretos.
const LOCAL = {
  url: process.env.TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  anon: process.env.TEST_SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  service: process.env.TEST_SUPABASE_SERVICE_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
};

const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws as never } };

export async function supabaseIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL.url}/auth/v1/health`, { headers: { apikey: LOCAL.anon }, signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export const admin: SupabaseClient = createClient(LOCAL.url, LOCAL.service, opts);

export interface TestUser {
  id: string;
  email: string;
  token: string;
  db: SupabaseClient;
}

export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@test.local`;
  const password = 'Test-password-123';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const anon = createClient(LOCAL.url, LOCAL.anon, opts);
  const session = await anon.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) throw session.error ?? new Error('sin sesión');
  const token = session.data.session.access_token;
  const db = createClient(LOCAL.url, LOCAL.anon, { ...opts, global: { headers: { Authorization: `Bearer ${token}` } } });
  return { id: created.data.user.id, email, token, db };
}

export async function deleteTestUser(u: TestUser): Promise<void> {
  await admin.auth.admin.deleteUser(u.id);
}

export function createTestApp() {
  return createApp(loadConfig({
    SUPABASE_URL: LOCAL.url, SUPABASE_ANON_KEY: LOCAL.anon, CORS_ORIGIN: 'http://localhost:5173',
  }));
}
