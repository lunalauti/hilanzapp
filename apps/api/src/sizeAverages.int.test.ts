import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('promedio real por talle (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};
  const dancer: Record<string, string> = {};

  const averages = async (sizes: string[]) => (await A.get(`/groups/${groupId}/production/size-averages?mold_type_id=${mold.pantalon}&sizes=${sizes.join(',')}`)).body.sizes;
  const measureOf = (sizes: { label: string; measures: { key: string; value: number | null; source: string; dancerCount: number }[] }[], label: string, key: string) =>
    sizes.find((s) => s.label === label)?.measures.find((m) => m.key === key);

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    groupId = (await A.post('/groups', { name: 'Ágata' })).body.id;

    const cadera: Record<string, number> = { Ana: 93, Bea: 95, Cami: 99 };
    for (const [name, value] of Object.entries(cadera)) {
      dancer[name] = (await A.post('/dancers', { groupId, name, age: 30 })).body.id;
      await A.put(`/dancers/${dancer[name]}/measurements/${def.cadera}`, { valueCm: value });
    }
    for (const name of ['Ana', 'Bea', 'Cami']) await A.post('/assignments', { dancerId: dancer[name], moldTypeId: mold.pantalon });
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('promedia la medida real de las bailarinas del talle pedido', async () => {
    const sizes = await averages(['42']);
    const cadera = measureOf(sizes, '42', 'cadera');
    expect(cadera).toMatchObject({ source: 'real', dancerCount: 2, value: 94 });
  });

  it('usa la tabla de talles cuando ninguna bailarina del talle tiene la medida cargada', async () => {
    const sizes = await averages(['42']);
    const cintura = measureOf(sizes, '42', 'cintura');
    expect(cintura).toMatchObject({ source: 'table' });
    expect(cintura?.value).not.toBeNull();
    expect(sizes[0]).toMatchObject({ label: '42', tableName: expect.any(String), ageRange: 'mujer' });
  });

  it('pide varios talles en una sola llamada', async () => {
    const sizes = await averages(['42', '44']);
    expect(sizes.map((s: { label: string }) => s.label)).toEqual(['42', '44']);
    expect(measureOf(sizes, '44', 'cadera')).toMatchObject({ source: 'real', dancerCount: 1, value: 99 });
  });

  it('un talle sin bailarinas todavía devuelve el punto medio de la tabla', async () => {
    const sizes = await averages(['58']);
    expect(measureOf(sizes, '58', 'cadera')).toMatchObject({ source: 'table', dancerCount: 0 });
  });

  it('molde inexistente da 404', async () => {
    expect((await A.get(`/groups/${groupId}/production/size-averages?mold_type_id=5f0c9e3e-0000-4000-8000-000000000000&sizes=42`)).status).toBe(404);
  });

  it('B no ve el promedio del grupo de A', async () => {
    expect((await B.get(`/groups/${groupId}/production/size-averages?mold_type_id=${mold.pantalon}&sizes=42`)).status).toBe(404);
  });
});
