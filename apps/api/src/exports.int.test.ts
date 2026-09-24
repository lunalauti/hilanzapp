import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function pdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return { text: result.text, pages: result.total };
}

describe.skipIf(!up)('exportación a PDF (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  let sheetId: string;
  let vestidoSheetId: string;
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};

  const getPdf = (u: TestUser, path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${u.token}`).buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  const postPdf = (u: TestUser, path: string, body: object) => request(app).post(`/api/v1${path}`).set('Authorization', `Bearer ${u.token}`).send(body).buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    groupId = (await A.post('/groups', { name: 'Ágata' })).body.id;
    const martina = (await A.post('/dancers', { groupId, name: 'Martina López', age: 30 })).body.id;
    const sofia = (await A.post('/dancers', { groupId, name: 'Sofía Ferreyra', age: 30 })).body.id;
    const full = { pecho: 88, cintura: 68, cadera: 92, cuello: 36, ancho_espalda: 40, ancho_hombro: 13.5, largo_delantero: 44, largo_trasero: 42, segunda_cintura: 80, bajo_busto: 75.36, largo_busto: 25, separacion_busto: 19, largo_hombro_rodilla: 90 };
    for (const [k, v] of Object.entries(full)) await A.put(`/dancers/${martina}/measurements/${def[k]}`, { valueCm: v });

    const design = (await A.post('/designs', { name: 'Aurora', notes: 'Hombro izquierdo descubierto', constructionDetails: 'Cierre invisible espalda 35 cm' })).body.id;
    const ticket = (await A.post(`/designs/${design}/images/upload-url`, { filename: 'ref.png', mime: 'image/png', size: PNG.length })).body;
    await a.db.storage.from('design-images').uploadToSignedUrl(ticket.path, ticket.token, new Blob([PNG], { type: 'image/png' }));
    await A.post(`/designs/${design}/images`, { path: ticket.path, filename: 'ref.png' });

    sheetId = (await A.post('/pattern-sheets', { dancerId: martina, moldTypeId: mold.cuerpo_base })).body.id;
    vestidoSheetId = (await A.post('/pattern-sheets', { dancerId: martina, moldTypeId: mold.vestido_campana_canesu, designId: design, manualInputs: { largo_canesu: 12 }, choices: { vuelo: 'media_campana' } })).body.id;
    await A.post('/assignments', { dancerId: martina, moldTypeId: mold.pantalon });
    await A.post('/assignments', { dancerId: sofia, moldTypeId: mold.pantalon });
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('la hoja de molde sale como PDF con nombre, medidas reales, fórmulas y resultados', async () => {
    const res = await getPdf(a, `/pattern-sheets/${sheetId}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('hoja-molde-martina-lopez-cuerpo-base.pdf');
    const buffer = res.body as Buffer;
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');

    const { text } = await pdfText(buffer);
    expect(text).toContain('Martina López');
    expect(text).toContain('Cuerpo base');
    expect(text).toContain('Grupo Ágata');
    expect(text).toContain('T42');
    expect(text).toContain('1/4 pecho');
    expect(text).toContain('88');
    expect(text).toContain('÷ 4');
    expect(text).toContain('22');
    expect(text).toContain('Escote / base cuello');
    expect(text).toContain('Hilanzapp');
  });

  it('incluye campos manuales, el vuelo elegido, las notas y la imagen del diseño', async () => {
    const res = await getPdf(a, `/pattern-sheets/${vestidoSheetId}/pdf`);
    const buffer = res.body as Buffer;
    const { text } = await pdfText(buffer);
    expect(text).toContain('Largo de canesú: 12 cm');
    expect(text).toContain('tipo de vuelo 1/2 campana');
    expect(text).toContain('Hombro izquierdo descubierto');
    expect(text).toContain('Cierre invisible espalda 35 cm');
    expect(text).toContain('CANESÚ');
    expect(text).toContain('FALDA');
    expect(text).toContain('÷ 3,14');
    expect(buffer.includes(Buffer.from('/Subtype /Image')) || buffer.includes(Buffer.from('/Subtype/Image'))).toBe(true);
  });

  it('los símbolos ÷ × − se ven bien (fuente embebida)', async () => {
    const res = await getPdf(a, `/pattern-sheets/${vestidoSheetId}/pdf`);
    const { text } = await pdfText(res.body as Buffer);
    expect(text).toContain('÷');
    expect(text).toContain('−');
    expect(text).not.toContain('�');
  });

  it('un lote junta varias hojas en un solo PDF', async () => {
    const res = await postPdf(a, '/pattern-sheets/pdf', { sheetIds: [sheetId, vestidoSheetId] });
    expect(res.status).toBe(200);
    const { text, pages } = await pdfText(res.body as Buffer);
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(text).toContain('Cuerpo base');
    expect(text).toContain('Vestido campana con canesú');
    expect(text).toContain('1 / 2');
  });

  it('valida el lote: vacío, demasiado grande, ids inválidos o de otra usuaria', async () => {
    expect((await postPdf(a, '/pattern-sheets/pdf', { sheetIds: [] })).status).toBe(422);
    expect((await postPdf(a, '/pattern-sheets/pdf', { sheetIds: Array(51).fill(sheetId) })).status).toBe(422);
    expect((await postPdf(a, '/pattern-sheets/pdf', { sheetIds: ['x'] })).status).toBe(422);
    expect((await postPdf(b, '/pattern-sheets/pdf', { sheetIds: [sheetId] })).status).toBe(404);
    expect((await getPdf(b, `/pattern-sheets/${sheetId}/pdf`)).status).toBe(404);
  });

  it('lista la última hoja guardada de cada bailarina del grupo para exportar en lote', async () => {
    const res = await A.get(`/groups/${groupId}/pattern-sheets?mold_type_id=${mold.cuerpo_base}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ dancerName: 'Martina López', sheetId, sizeLabel: '42' }),
      expect.objectContaining({ dancerName: 'Sofía Ferreyra', sheetId: null, sizeLabel: null, createdAt: null }),
    ]);
    expect((await A.get(`/groups/${groupId}/pattern-sheets`)).status).toBe(422);
    expect((await B.get(`/groups/${groupId}/pattern-sheets?mold_type_id=${mold.cuerpo_base}`)).body).toEqual([]);
  });

  it('el resumen de producción sale con cantidades por talle y los nombres', async () => {
    const res = await getPdf(a, `/groups/${groupId}/production/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('produccion-agata.pdf');
    const { text } = await pdfText(res.body as Buffer);
    expect(text).toContain('Ágata');
    expect(text).toContain('Pantalón');
    expect(text).toContain('T42');
    expect(text).toContain('Martina López');
    expect(text).toContain('PENDIENTES');
    expect(text).toContain('Sofía Ferreyra');
    expect((await getPdf(b, `/groups/${groupId}/production/pdf`)).status).toBe(404);
  });
});
