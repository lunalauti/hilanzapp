import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('tablas de talles editables (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  let dancerId: string;
  const def: Record<string, string> = {};
  const table: Record<string, string> = {};
  let copyId: string;

  const sizing = async () => (await A.get(`/dancers/${dancerId}/sizing`)).body;
  const cell = (grid: { sizes: { label: string; values: Record<string, { value: number; origin: string }> }[] }, label: string, key: string) =>
    grid.sizes.find((s) => s.label === label)?.values[key];

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const t of (await A.get('/size-tables')).body as { id: string; templateKey: string }[]) table[t.templateKey] = t.id;
    groupId = (await A.post('/groups', { name: 'Ágata' })).body.id;
    dancerId = (await A.post('/dancers', { groupId, name: 'Martina', age: 30 })).body.id;
    for (const [k, v] of Object.entries({ pecho: 88, cintura: 70, cadera: 100 })) await A.put(`/dancers/${dancerId}/measurements/${def[k]}`, { valueCm: v });
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('lista las tablas precargadas con su estado', async () => {
    const list = (await A.get('/size-tables')).body;
    expect(list.map((t: { templateKey: string }) => t.templateKey).sort()).toEqual(['adolescentes', 'bebes', 'mujeres', 'ninos']);
    const mujeres = list.find((t: { templateKey: string }) => t.templateKey === 'mujeres');
    expect(mujeres).toMatchObject({ ageRange: 'mujer', isActive: true, sizeCount: 10 });
  });

  it('devuelve la grilla completa talle × medida con el origen de cada celda', async () => {
    const grid = (await A.get(`/size-tables/${table.mujeres}`)).body;
    expect(grid.sizes.map((s: { label: string }) => s.label)).toEqual(['40', '42', '44', '46', '48', '50', '52', '54', '56', '58']);
    expect(grid.measures.map((m: { key: string }) => m.key)).toEqual(expect.arrayContaining(['pecho', 'cintura', 'cadera', 'altura_tiro']));
    expect(cell(grid, '42', 'pecho')).toEqual({ value: 90, origin: 'source' });
    expect(cell(grid, '42', 'altura_tiro')).toEqual({ value: 26.2, origin: 'extrapolated' });
    const teens = (await A.get(`/size-tables/${table.adolescentes}`)).body;
    expect(cell(teens, '16', 'pecho')).toEqual({ value: 83, origin: 'interpolated' });
    expect((await A.get('/size-tables/5f0c9e3e-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('duplicar crea una copia editable sin tocar la original y conserva los orígenes', async () => {
    const res = await A.post(`/size-tables/${table.mujeres}/duplicate`, { name: 'Mujeres — mi ajuste' });
    expect(res.status).toBe(201);
    copyId = res.body.id;
    expect(res.body).toMatchObject({ name: 'Mujeres — mi ajuste', ageRange: 'mujer', isActive: false, baseTableId: table.mujeres, templateKey: null });
    expect(res.body.sizes).toHaveLength(10);
    expect(cell(res.body, '42', 'altura_tiro')).toEqual({ value: 26.2, origin: 'extrapolated' });
    expect((await A.post(`/size-tables/${table.mujeres}/duplicate`, {})).body.name).toBe('Mujeres — Baúl de Moda (copia)');
    expect(cell((await A.get(`/size-tables/${table.mujeres}`)).body, '42', 'pecho')?.origin).toBe('source');
  });

  it('editar celdas las marca como editadas por la usuaria y permite borrar valores', async () => {
    const res = await A.patch(`/size-tables/${copyId}/values`, { changes: [{ sizeLabel: '42', measureKey: 'pecho', value: 88 }, { sizeLabel: '42', measureKey: 'altura_tiro', value: 26.5 }, { sizeLabel: '40', measureKey: 'botamanga', value: null }] });
    expect(res.status).toBe(200);
    expect(cell(res.body, '42', 'pecho')).toEqual({ value: 88, origin: 'user' });
    expect(cell(res.body, '42', 'altura_tiro')).toEqual({ value: 26.5, origin: 'user' });
    expect(cell(res.body, '40', 'botamanga')).toBeUndefined();
    expect(cell((await A.get(`/size-tables/${table.mujeres}`)).body, '42', 'pecho')).toEqual({ value: 90, origin: 'source' });
  });

  it('valida las ediciones', async () => {
    const edit = (c: object) => A.patch(`/size-tables/${copyId}/values`, { changes: [c] });
    expect((await edit({ sizeLabel: '42', measureKey: 'pecho', value: -1 })).status).toBe(422);
    expect((await edit({ sizeLabel: '42', measureKey: 'pecho', value: 'x' })).status).toBe(422);
    expect((await edit({ sizeLabel: '99', measureKey: 'pecho', value: 5 })).body.error.code).toBe('UNKNOWN_SIZE');
    expect((await edit({ sizeLabel: '42', measureKey: 'inexistente', value: 5 })).body.error.code).toBe('UNKNOWN_MEASURE');
    expect((await A.patch(`/size-tables/${copyId}/values`, { changes: [] })).status).toBe(422);
  });

  it('activar la copia cambia la sugerencia de talle sin tocar los talles manuales', async () => {
    expect(await sizing()).toMatchObject({ suggested: '42', table: { id: table.mujeres } });
    await A.put(`/dancers/${dancerId}/size`, { manualSizeLabel: '50' });
    const act = await A.post(`/size-tables/${copyId}/activate`);
    expect(act.status).toBe(200);
    expect(act.body.isActive).toBe(true);
    const list = (await A.get('/size-tables')).body;
    expect(list.filter((t: { ageRange: string; isActive: boolean }) => t.ageRange === 'mujer' && t.isActive)).toHaveLength(1);
    // pecho 88 ahora coincide exacto con el T42 editado (88) y ya no es empate
    const s = await sizing();
    expect(s).toMatchObject({ suggested: '42', table: { id: copyId }, manual: { dancer: '50' }, effective: { label: '50', origin: 'dancer' } });
    expect(s.perMeasure.find((m: { measureKey: string }) => m.measureKey === 'pecho').sizeLabel).toBe('42');
  });

  it('una edición de la tabla activa cambia la sugerencia al instante y respeta el talle manual', async () => {
    await A.patch(`/size-tables/${copyId}/values`, { changes: [{ sizeLabel: '40', measureKey: 'pecho', value: 88 }, { sizeLabel: '42', measureKey: 'pecho', value: 95 }] });
    const s = await sizing();
    expect(s.suggested).toBe('40');
    expect(s.manual.dancer).toBe('50');
    await A.put(`/dancers/${dancerId}/size`, { manualSizeLabel: null });
  });

  it('agrega y quita talles de una tabla propia', async () => {
    const added = await A.post(`/size-tables/${copyId}/sizes`, { label: '60', descriptor: 'XL', values: { pecho: 130, cintura: 118, cadera: 138 } });
    expect(added.status).toBe(201);
    expect(cell(added.body, '60', 'pecho')).toEqual({ value: 130, origin: 'user' });
    expect(added.body.sizes.at(-1)).toMatchObject({ label: '60', descriptor: 'XL' });
    expect((await A.post(`/size-tables/${copyId}/sizes`, { label: '60' })).status).toBe(409);
    const sizeId = added.body.sizes.at(-1).id;
    const removed = await A.del(`/size-tables/${copyId}/sizes/${sizeId}`);
    expect(removed.body.sizes.some((s: { label: string }) => s.label === '60')).toBe(false);
    expect((await A.del(`/size-tables/${copyId}/sizes/${sizeId}`)).status).toBe(404);
  });

  it('crea una tabla personalizada desde cero', async () => {
    const res = await A.post('/size-tables', { name: 'Mi tabla', ageRange: 'otro', sizes: [{ label: 'S', values: { pecho: 84, cintura: 66, cadera: 92 } }, { label: 'M', values: { pecho: 90, cintura: 72, cadera: 98 } }] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Mi tabla', ageRange: 'otro', isActive: false, templateKey: null });
    expect(res.body.sizes.map((s: { label: string }) => s.label)).toEqual(['S', 'M']);
    expect((await A.post('/size-tables', { name: ' ', ageRange: 'otro' })).status).toBe(422);
    expect((await A.post('/size-tables', { name: 'X', ageRange: 'otro', sizes: [{ label: 'S' }, { label: 'S' }] })).status).toBe(422);
    expect((await A.post('/size-tables', { name: 'X', ageRange: 'otro', sizes: [{ label: 'S', values: { medida_falsa: 1 } }] })).body.error.code).toBe('UNKNOWN_MEASURE');
    expect((await A.get('/size-tables')).body.some((t: { name: string }) => t.name === 'X')).toBe(false);
  });

  it('restaura una tabla precargada a los valores originales', async () => {
    await A.patch(`/size-tables/${table.ninos}/values`, { changes: [{ sizeLabel: '12', measureKey: 'pecho', value: 999 }] });
    expect(cell((await A.get(`/size-tables/${table.ninos}`)).body, '12', 'pecho')).toEqual({ value: 999, origin: 'user' });
    const res = await A.post(`/size-tables/${table.ninos}/restore`);
    expect(res.status).toBe(200);
    expect(cell(res.body, '12', 'pecho')).toEqual({ value: 80, origin: 'source' });
    const own = await A.post(`/size-tables/${copyId}/restore`);
    expect(own.status).toBe(422);
    expect(own.body.error.code).toBe('NO_TEMPLATE');
  });

  it('la tabla original de una copia activa se puede volver a activar', async () => {
    await A.post(`/size-tables/${table.mujeres}/activate`);
    expect(await sizing()).toMatchObject({ table: { id: table.mujeres } });
  });

  it('forzar una tabla por bailarina sigue funcionando con tablas propias', async () => {
    await A.patch(`/dancers/${dancerId}`, { sizeTableId: copyId });
    expect((await sizing()).table).toMatchObject({ id: copyId, forced: true });
    await A.patch(`/dancers/${dancerId}`, { sizeTableId: null });
  });

  it('las tablas precargadas no se eliminan; las propias sí, salvo que estén activas', async () => {
    expect((await A.del(`/size-tables/${table.mujeres}`)).body.error.code).toBe('TEMPLATE_TABLE');
    await A.post(`/size-tables/${copyId}/activate`);
    expect((await A.del(`/size-tables/${copyId}`)).body.error.code).toBe('TABLE_ACTIVE');
    await A.post(`/size-tables/${table.mujeres}/activate`);
    expect((await A.del(`/size-tables/${copyId}`)).status).toBe(204);
    expect((await A.get(`/size-tables/${copyId}`)).status).toBe(404);
  });

  it('renombrar y cambiar el rango de una tabla propia', async () => {
    const t = (await A.post('/size-tables', { name: 'Temporal', ageRange: 'otro' })).body.id;
    const res = await A.patch(`/size-tables/${t}`, { name: 'Temporal 2', ageRange: 'adolescente', source: 'Mi criterio' });
    expect(res.body).toMatchObject({ name: 'Temporal 2', ageRange: 'adolescente', source: 'Mi criterio' });
    expect((await A.patch(`/size-tables/${table.mujeres}`, { ageRange: 'nino' })).body.error.code).toBe('TABLE_ACTIVE');
    expect((await A.patch(`/size-tables/${t}`, { campo: 1 })).status).toBe(422);
  });

  it('B no ve ni modifica las tablas de A', async () => {
    expect((await B.get(`/size-tables/${table.mujeres}`)).status).toBe(404);
    expect((await B.patch(`/size-tables/${table.mujeres}/values`, { changes: [{ sizeLabel: '42', measureKey: 'pecho', value: 1 }] })).status).toBe(404);
    expect((await B.post(`/size-tables/${table.mujeres}/activate`)).status).toBe(404);
    expect((await B.post(`/size-tables/${table.mujeres}/duplicate`, {})).status).toBe(404);
    expect((await B.del(`/size-tables/${table.mujeres}`)).status).toBe(404);
    expect((await B.get('/size-tables')).body).toEqual([]);
  });
});
