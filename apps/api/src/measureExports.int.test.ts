import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

async function pdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

describe.skipIf(!up)('PDF de faltantes, hoja sin molde y producción (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let groupId: string;
  let emi: string;
  const def: Record<string, string> = {};

  const getPdf = (u: TestUser, path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${u.token}`).buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    groupId = (await A.post('/groups', { name: 'Amatista' })).body.id;
    emi = (await A.post('/dancers', { groupId, name: 'Emi Paz', age: 30 })).body.id;
    await A.post('/dancers', { groupId, name: 'Lucía Gómez', age: 30 });
    await A.put(`/dancers/${emi}/measurements/${def.pecho}`, { valueCm: 84 });
    await A.put(`/dancers/${emi}/measurements/${def.cadera}`, { valueCm: 88 });
    const design = (await A.post('/designs', {
      name: 'Jardín', garments: [{ custom: { name: 'Vestido evasé', category: 'vestido', sizePriority: 'cadera', measureIds: [def.pecho!, def.cadera!, def.largo_falda!] }, laborCost: 14000 }],
    })).body;
    await A.post(`/groups/${groupId}/design-assignment`, { designId: design.id });
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('el PDF de faltantes lista por bailarina lo que falta, con casilleros y espacio para notas', async () => {
    const res = await getPdf(a, `/groups/${groupId}/measure-plan/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    const text = await pdfText(res.body);
    expect(text).toContain('MEDIDAS QUE FALTAN');
    expect(text).toContain('Grupo Amatista');
    expect(text).toContain('Emi Paz');
    expect(text).toContain('Faltan 1');
    expect(text).toContain('Largo de falda');
    expect(text).toContain('Lucía Gómez');
    expect(text).toContain('Faltan 3');
    expect(text).toContain('Tomadas por');
    expect(text).toContain('NOTAS');
  });

  it('otra usuaria no puede exportar los faltantes (404)', async () => {
    expect((await getPdf(b, `/groups/${groupId}/measure-plan/pdf`)).status).toBe(404);
  });

  it('la hoja de una prenda sin molde sale simplificada, con medidas reales y "falta · anotar"', async () => {
    const mold = ((await A.get('/mold-types')).body as { id: string; name: string }[]).find((m) => m.name === 'Vestido evasé')!;
    const sheet = await A.post('/pattern-sheets', { dancerId: emi, moldTypeId: mold.id });
    expect(sheet.status).toBe(422); // falta el largo de falda
    await A.put(`/dancers/${emi}/measurements/${def.largo_falda}`, { valueCm: 55 });
    const saved = await A.post('/pattern-sheets', { dancerId: emi, moldTypeId: mold.id });
    expect(saved.status).toBe(201);
    const res = await getPdf(a, `/pattern-sheets/${saved.body.id}/pdf`);
    expect(res.status).toBe(200);
    const text = await pdfText(res.body);
    expect(text).toContain('HOJA DE PRENDA');
    expect(text).toContain('SIN MOLDE');
    expect(text).toContain('Vestido evasé');
    expect(text).toContain('según cadera');
    expect(text).toMatch(/Contorno de cadera/);
    expect(text).toMatch(/88/);
    expect(text).toContain('TRAZADO Y NOTAS');
    expect(text).not.toContain('FÓRMULA');
  });

  it('se puede exportar la hoja de prenda sin molde aunque falten medidas, sin guardarla', async () => {
    const mold = ((await A.get('/mold-types')).body as { id: string; name: string }[]).find((m) => m.name === 'Vestido evasé')!;
    const lucia = ((await A.get(`/groups/${groupId}/dancers`)).body as { id: string; name: string }[]).find((d) => d.name === 'Lucía Gómez')!;
    const res = await getPdf(a, `/dancers/${lucia.id}/garment-sheet/pdf?mold_type_id=${mold.id}`);
    expect(res.status).toBe(200);
    const text = await pdfText(res.body);
    expect(text).toContain('Lucía Gómez');
    expect(text).toContain('falta · anotar');
    expect((await getPdf(a, `/dancers/${lucia.id}/garment-sheet/pdf?mold_type_id=00000000-0000-4000-8000-000000000000`)).status).toBe(404);
    expect((await getPdf(b, `/dancers/${lucia.id}/garment-sheet/pdf?mold_type_id=${mold.id}`)).status).toBe(404);
    const normal = ((await A.get('/mold-types')).body as { id: string; hasPattern: boolean }[]).find((m) => m.hasPattern)!;
    expect((await getPdf(a, `/dancers/${lucia.id}/garment-sheet/pdf?mold_type_id=${normal.id}`)).status).toBe(422);
  });

  it('el PDF de producción marca la prenda sin molde', async () => {
    const res = await getPdf(a, `/groups/${groupId}/production/pdf`);
    expect(res.status).toBe(200);
    const text = await pdfText(res.body);
    expect(text).toContain('Vestido evasé');
    expect(text).toContain('Sin molde');
  });
});
