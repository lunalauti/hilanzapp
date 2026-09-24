import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
});

export interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseJwtSecret?: string;
  corsOrigins: string[];
  port: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configuración inválida o incompleta. Revisá las variables de entorno: ${missing}`);
  }
  const e = parsed.data;
  return {
    supabaseUrl: e.SUPABASE_URL.replace(/\/$/, ''),
    supabaseAnonKey: e.SUPABASE_ANON_KEY,
    supabaseJwtSecret: e.SUPABASE_JWT_SECRET,
    corsOrigins: e.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
    port: e.PORT,
  };
}
