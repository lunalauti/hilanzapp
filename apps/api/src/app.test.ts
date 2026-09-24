import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { loadConfig } from './config';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const config = loadConfig({
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_JWT_SECRET: SECRET,
  CORS_ORIGIN: 'https://hilanzapp.vercel.app, http://localhost:5173',
});
const app = createApp(config);

async function token(opts: { sub?: string; exp?: string; secret?: string; aud?: string } = {}) {
  return new SignJWT({ email: 'modista@test.local' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.sub ?? 'user-1')
    .setIssuer('http://127.0.0.1:54321/auth/v1')
    .setAudience(opts.aud ?? 'authenticated')
    .setExpirationTime(opts.exp ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

describe('autenticación', () => {
  it('GET /health es público', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('401 sin token', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Falta iniciar sesión' } });
  });

  it('401 con token mal firmado, vencido o de otra audiencia', async () => {
    for (const t of [await token({ secret: 'otra-clave-distinta-de-32-caracteres!!!!' }), await token({ exp: '-1m' }), await token({ aud: 'anon' }), 'basura']) {
      const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('con token válido identifica a la usuaria', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${await token({ sub: 'abc-123' })}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'abc-123', email: 'modista@test.local' });
  });
});

describe('formato de errores', () => {
  it('ruta inexistente devuelve el envelope 404', async () => {
    const res = await request(app).get('/nada');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('JSON inválido devuelve 400 BAD_JSON', async () => {
    const res = await request(app).post('/api/v1/me').set('Content-Type', 'application/json').send('{no es json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });
});

describe('CORS', () => {
  it('permite los orígenes configurados', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://hilanzapp.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://hilanzapp.vercel.app');
  });

  it('no autoriza otros orígenes', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://malicioso.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('responde el preflight con los métodos permitidos', async () => {
    const res = await request(app).options('/api/v1/me').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'PUT');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('PUT');
  });
});

describe('loadConfig', () => {
  it('falla con un mensaje claro si falta una variable', () => {
    expect(() => loadConfig({ SUPABASE_URL: 'http://x.test' })).toThrow(/SUPABASE_ANON_KEY.*CORS_ORIGIN|CORS_ORIGIN.*SUPABASE_ANON_KEY/);
  });
  it('normaliza la lista de orígenes y el puerto por defecto', () => {
    const c = loadConfig({ SUPABASE_URL: 'http://x.test/', SUPABASE_ANON_KEY: 'k', CORS_ORIGIN: 'a, b' });
    expect(c).toMatchObject({ supabaseUrl: 'http://x.test', corsOrigins: ['a', 'b'], port: 3001 });
  });
});
