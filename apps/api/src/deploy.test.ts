import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

describe('configuración de despliegue', () => {
  it('render.yaml declara todas las variables que exige la API', () => {
    let missing: string[] = [];
    try { loadConfig({}); } catch (e) { missing = [...(e as Error).message.matchAll(/[A-Z_]{4,}/g)].map((m) => m[0]).filter((v) => v.startsWith('SUPABASE') || v === 'CORS_ORIGIN'); }
    expect(missing.sort()).toEqual(['CORS_ORIGIN', 'SUPABASE_ANON_KEY', 'SUPABASE_URL']);
    const yaml = read('render.yaml');
    for (const key of missing) expect(yaml).toContain(`key: ${key}`);
  });

  it('las claves secretas no llevan valor en render.yaml (se cargan en el panel)', () => {
    const yaml = read('render.yaml');
    expect(yaml).toMatch(/key: SUPABASE_ANON_KEY\n\s+sync: false/);
    expect(yaml).toMatch(/key: CORS_ORIGIN\n\s+sync: false/);
    expect(yaml).toContain('healthCheckPath: /health');
  });

  it('Vercel reescribe todo a index.html para que funcionen las rutas de la SPA', () => {
    const vercel = JSON.parse(read('apps/web/vercel.json')) as { rewrites: { source: string; destination: string }[]; installCommand: string };
    expect(vercel.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
    expect(vercel.installCommand).toContain('npm ci');
  });

  it('cada app documenta sus variables en un .env.example', () => {
    expect(read('.env.example')).toContain('SUPABASE_ANON_KEY');
    expect(read('apps/web/.env.example')).toMatch(/VITE_API_URL[\s\S]*|VITE_SUPABASE_URL/);
    for (const v of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_URL']) expect(read('apps/web/.env.example')).toContain(v);
  });
});
