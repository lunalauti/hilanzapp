import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { admin, createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('moldería y hojas de molde (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let dancerId: string;
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};

  const setMeasures = async (values: Record<string, number>) => {
    for (const [key, value] of Object.entries(values)) await A.put(`/dancers/${dancerId}/measurements/${def[key]}`, { valueCm: value });
  };
  const calc = (moldKey: string, extra: object = {}) => A.post('/calculations', { dancerId, moldTypeId: mold[moldKey], ...extra });
  const rowsOf = (body: { rows: { key: string; result: number }[] }) => Object.fromEntries(body.rows.map((r) => [r.key, r.result]));

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    const group = (await A.post('/groups', { name: 'Ágata' })).body.id;
    dancerId = (await A.post('/dancers', { groupId: group, name: 'Martina', age: 30 })).body.id;
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('lista los 11 moldes con sus datos y fórmulas', async () => {
    const list = (await A.get('/mold-types')).body;
    expect(list).toHaveLength(11);
    const vestido = list.find((m: { key: string }) => m.key === 'vestido_campana_canesu');
    expect(vestido.sizePriority).toBe('both');
    expect(vestido.inputs.find((i: { key: string }) => i.key === 'vuelo').options).toHaveLength(3);
    expect(vestido.formulas.map((f: { key: string }) => f.key)).toEqual(['cuarto_pecho', 'medio_espalda', 'largo_busto_molde', 'separacion_busto_molde', 'largo_delantero_molde', 'largo_canesu_molde', 'radio_falda', 'largo_falda_vestido']);
  });

  it('sin medidas bloquea el cálculo y lista qué falta', async () => {
    await setMeasures({ pecho: 88 });
    const res = await calc('cuerpo_base');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MISSING_MEASUREMENTS');
    const keys = res.body.error.details.missing.map((m: { key: string }) => m.key);
    expect(keys).toEqual(expect.arrayContaining(['cuello', 'ancho_espalda', 'cintura', 'cadera']));
    expect(keys).not.toContain('pecho');
  });

  it('cuerpo base: real → fórmula → resultado, con la altura de cadera de la tabla', async () => {
    await setMeasures({ cuello: 36, ancho_espalda: 40, ancho_hombro: 13.5, largo_delantero: 44, largo_trasero: 42, cintura: 68, cadera: 92, segunda_cintura: 80 });
    const res = await calc('cuerpo_base');
    expect(res.status).toBe(200);
    expect(res.body.size).toMatchObject({ label: '42', origin: 'suggested' });
    expect(rowsOf(res.body)).toMatchObject({ cuarto_pecho: 22, base_cuello: 6, medio_espalda: 20, hombro: 13.5, cuarto_cintura: 17, cuarto_cadera: 23, cuarto_segunda_cintura: 20, altura_cadera_molde: 17 });
    expect(res.body.rows[0]).toMatchObject({ key: 'cuarto_pecho', realLabel: 'Contorno de pecho', realValue: 88, formula: '÷ 4', result: 22 });
    // la medida real no se modificó
    const m = (await A.get(`/dancers/${dancerId}/measurements`)).body.find((x: { key: string }) => x.key === 'pecho');
    expect(m.valueCm).toBe(88);
  });

  it('manga: pide la sisa dibujada y calcula el rectángulo', async () => {
    await setMeasures({ largo_manga: 58, muneca: 15 });
    const missing = await calc('manga');
    expect(missing.status).toBe(422);
    expect(missing.body.error.details.missing).toEqual([{ key: 'sisa', label: 'Medida de sisa dibujada', source: 'manual' }]);
    const ok = await calc('manga', { manualInputs: { sisa: 21 } });
    expect(rowsOf(ok.body)).toMatchObject({ ancho_rectangulo: 20, alto_rectangulo: 14, largo_manga_molde: 58, muneca_molde: 15 });
    expect((await calc('manga', { manualInputs: { sisa: -3 } })).status).toBe(422);
  });

  it('pantalón: la altura de tiro sale de la tabla (valor extrapolado del talle 42)', async () => {
    await setMeasures({ largo_pantalon: 100 });
    const res = await calc('pantalon');
    expect(res.status).toBe(200);
    expect(rowsOf(res.body)).toMatchObject({ cuarto_cadera: 23, altura_tiro_molde: 26.2, ancho_tiro_delantero: 3.45, ancho_tiro_trasero: 10.35 });
  });

  it('faldas: el vuelo cambia el radio y el elástico usa la cintura', async () => {
    await setMeasures({ largo_falda: 55 });
    const media = rowsOf((await calc('falda_media_campana_elastico')).body);
    const doble = rowsOf((await calc('falda_doble_campana_elastico')).body);
    expect(media).toMatchObject({ radio: 29.3, elastico: 57.8, largo_molde: 55 });
    expect(doble).toMatchObject({ radio: 7.3 });
    const cierre = rowsOf((await calc('falda_campana_cierre')).body);
    expect(cierre.radio).toBe(10.8);
    expect((await calc('falda_fruncida', { choices: { frunce: 'x2' } })).body.rows[0].result).toBe(184);
  });

  it('vestido con canesú: usa el vuelo elegido y agrupa el talle por pecho', async () => {
    await setMeasures({ bajo_busto: 75.36, largo_hombro_rodilla: 90, largo_busto: 25, separacion_busto: 19 });
    const manual = { largo_canesu: 12 };
    const campana = await calc('vestido_campana_canesu', { manualInputs: manual });
    expect(rowsOf(campana.body)).toMatchObject({ cuarto_pecho: 22, radio_falda: 12, largo_falda_vestido: 78 });
    const media = await calc('vestido_campana_canesu', { manualInputs: manual, choices: { vuelo: 'media_campana' } });
    expect(rowsOf(media.body).radio_falda).toBe(24);
    expect(media.body.rows.find((r: { key: string }) => r.key === 'radio_falda').section).toBe('Falda');
  });

  it('sin valor estándar en la tabla responde MISSING_STANDARD', async () => {
    const { data: tbl } = await admin.from('size_tables').select('id').eq('owner_id', a.id).eq('template_key', 'mujeres').single();
    const { data: size } = await admin.from('size_table_sizes').select('id').eq('table_id', tbl!.id).eq('label', '42').single();
    const { data: rows } = await admin.from('size_table_values').select('id, value_cm, measure_definitions!inner(key)').eq('size_id', size!.id).eq('measure_definitions.key', 'altura_tiro');
    await admin.from('size_table_values').delete().eq('id', rows![0]!.id);
    const res = await calc('pantalon');
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'MISSING_STANDARD', details: { size: '42', missing: [{ key: 'altura_tiro', source: 'standard' }] } });
    await admin.from('size_table_values').insert({ owner_id: a.id, size_id: size!.id, definition_id: def.altura_tiro, value_cm: rows![0]!.value_cm, origin: 'user' });
    expect((await calc('pantalon')).status).toBe(200);
  });

  it('la hoja guardada conserva sus valores aunque después se edite la fórmula', async () => {
    const saved = await A.post('/pattern-sheets', { dancerId, moldTypeId: mold.cuerpo_base });
    expect(saved.status).toBe(201);
    expect(rowsOf(saved.body).cuarto_pecho).toBe(22);

    await admin.from('mold_formulas').update({ adjustment_cm: 1 }).eq('mold_type_id', mold.cuerpo_base).eq('key', 'cuarto_pecho');
    expect(rowsOf((await calc('cuerpo_base')).body).cuarto_pecho).toBe(23);

    const sheet = (await A.get(`/pattern-sheets/${saved.body.id}`)).body;
    expect(rowsOf(sheet).cuarto_pecho).toBe(22);
    expect(sheet.formulas.find((f: { key: string }) => f.key === 'cuarto_pecho').adjustmentCm).toBe(0);
    expect(sheet).toMatchObject({ sizeLabel: '42', dancer: { name: 'Martina' }, mold: { key: 'cuerpo_base' } });

    const list = (await A.get(`/dancers/${dancerId}/pattern-sheets`)).body;
    expect(list).toEqual([expect.objectContaining({ id: saved.body.id, moldKey: 'cuerpo_base', sizeLabel: '42' })]);
  });

  it('B no accede a hojas ni cálculos de A', async () => {
    const sheetId = (await A.get(`/dancers/${dancerId}/pattern-sheets`)).body[0].id;
    expect((await B.get(`/pattern-sheets/${sheetId}`)).status).toBe(404);
    expect((await B.post('/calculations', { dancerId, moldTypeId: mold.cuerpo_base })).status).toBe(404);
    expect((await B.get(`/dancers/${dancerId}/pattern-sheets`)).status).toBe(404);
  });
});
