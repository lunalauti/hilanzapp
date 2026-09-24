import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

describe.skipIf(!up)('resumen de producción (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  const def: Record<string, string> = {};
  const mold: Record<string, string> = {};
  const dancer: Record<string, string> = {};
  const assignment: Record<string, string> = {};

  const production = async () => (await A.get(`/groups/${groupId}/production`)).body;
  const sizes = (p: { byGarment: { moldKey: string; sizes: { label: string; count: number }[] }[] }, key: string) =>
    p.byGarment.find((g) => g.moldKey === key)?.sizes.map((s) => [s.label, s.count]);

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string }[]) mold[m.key] = m.id;
    groupId = (await A.post('/groups', { name: 'Ágata' })).body.id;

    const cadera: Record<string, number | null> = { Ana: 90, Bea: 98, Cami: 98, Dani: null, Eli: null };
    for (const [name, value] of Object.entries(cadera)) {
      dancer[name] = (await A.post('/dancers', { groupId, name, age: 30 })).body.id;
      if (value !== null) await A.put(`/dancers/${dancer[name]}/measurements/${def.cadera}`, { valueCm: value });
    }
    for (const name of ['Ana', 'Bea', 'Cami', 'Dani']) {
      assignment[name] = (await A.post('/assignments', { dancerId: dancer[name], moldTypeId: mold.pantalon })).body.id;
    }
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('cuenta por prenda y talle con los nombres, y deja pendientes a quienes no entran', async () => {
    const p = await production();
    expect(sizes(p, 'pantalon')).toEqual([['40', 1], ['44', 2]]);
    expect(p.byGarment[0]).toMatchObject({ moldName: 'Pantalón', total: 3 });
    expect(p.byGarment[0].sizes[1].dancers).toEqual(['Bea', 'Cami']);
    expect(p.totalUnits).toBe(3);
    expect(p.pending).toEqual([
      { dancerId: dancer.Dani, name: 'Dani', reason: 'no_size', moldNames: ['Pantalón'] },
      { dancerId: dancer.Eli, name: 'Eli', reason: 'no_assignment', moldNames: [] },
    ]);
  });

  it('se recalcula al cambiar un talle manual de prenda', async () => {
    await A.patch(`/assignments/${assignment.Cami}`, { manualSizeLabel: '46' });
    expect(sizes(await production(), 'pantalon')).toEqual([['40', 1], ['44', 1], ['46', 1]]);
  });

  it('se recalcula al cambiar una medida y al cargar las que faltaban', async () => {
    await A.put(`/dancers/${dancer.Ana}/measurements/${def.cadera}`, { valueCm: 106 });
    expect(sizes(await production(), 'pantalon')).toEqual([['44', 1], ['46', 1], ['48', 1]]);
    await A.put(`/dancers/${dancer.Dani}/measurements/${def.cadera}`, { valueCm: 90 });
    const p = await production();
    expect(sizes(p, 'pantalon')).toEqual([['40', 1], ['44', 1], ['46', 1], ['48', 1]]);
    expect(p.pending.map((x: { name: string }) => x.name)).toEqual(['Eli']);
  });

  it('el talle general manual aplica a las prendas sin talle propio', async () => {
    await A.put(`/dancers/${dancer.Bea}/size`, { manualSizeLabel: '50' });
    expect(sizes(await production(), 'pantalon')).toEqual([['40', 1], ['46', 1], ['48', 1], ['50', 1]]);
  });

  it('agrupa por cada prenda y ordena las prendas por nombre', async () => {
    await A.put(`/dancers/${dancer.Ana}/measurements/${def.pecho}`, { valueCm: 88 });
    await A.post('/assignments', { dancerId: dancer.Ana, moldTypeId: mold.cuerpo_base });
    const p = await production();
    expect(p.byGarment.map((g: { moldName: string }) => g.moldName)).toEqual(['Cuerpo base', 'Pantalón']);
    expect(sizes(p, 'cuerpo_base')).toEqual([['42', 1]]);
    expect(p.totalUnits).toBe(5);
  });

  it('quitar una asignación baja el conteo y un grupo vacío devuelve todo en cero', async () => {
    await A.del(`/assignments/${assignment.Ana}`);
    expect(sizes(await production(), 'pantalon')).toEqual([['40', 1], ['46', 1], ['50', 1]]);
    const empty = (await A.post('/groups', { name: 'Vacío' })).body.id;
    expect((await A.get(`/groups/${empty}/production`)).body).toEqual({ dancerCount: 0, byGarment: [], pending: [], totalUnits: 0 });
  });

  it('B no ve la producción de A', async () => {
    expect((await B.get(`/groups/${groupId}/production`)).status).toBe(404);
  });
});
