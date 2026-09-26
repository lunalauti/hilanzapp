import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client } from './test/api';
import { createTestApp, createTestUser, deleteTestUser, supabaseIsUp, type TestUser } from './test/supabase';

const up = await supabaseIsUp();

interface PlanItem { key: string; name: string; value: number | null; requiredBy: { kind: string; label: string }[] }

describe.skipIf(!up)('plan de medidas según lo asignado (Supabase local)', () => {
  const app = createTestApp();
  let a: TestUser;
  let b: TestUser;
  let A: ReturnType<typeof client>;
  let B: ReturnType<typeof client>;
  let groupId: string;
  let dancerId: string;
  let otherId: string;
  let designId: string;
  const def: Record<string, string> = {};
  const mold: Record<string, { id: string; inputs: { source: string; key: string; measureKey?: string }[] }> = {};
  const plan = async (id = dancerId) => (await A.get(`/dancers/${id}/measure-plan`)).body as { items: PlanItem[]; total: number; done: number; missing: number; status: string };
  const pantsKeys = () => mold.pantalon!.inputs.filter((i) => i.source === 'measure').map((i) => i.measureKey ?? i.key);

  beforeAll(async () => {
    a = await createTestUser('a');
    b = await createTestUser('b');
    A = client(app, a);
    B = client(app, b);
    await A.post('/me/bootstrap');
    for (const d of (await A.get('/measure-definitions')).body as { id: string; key: string }[]) def[d.key] = d.id;
    for (const m of (await A.get('/mold-types')).body as { id: string; key: string; inputs: { source: string; key: string; measureKey?: string }[] }[]) mold[m.key] = m;
    groupId = (await A.post('/groups', { name: 'Amatista' })).body.id;
    dancerId = (await A.post('/dancers', { groupId, name: 'Emi', age: 9 })).body.id;
    otherId = (await A.post('/dancers', { groupId, name: 'Ana', age: 9 })).body.id;
  });
  afterAll(async () => {
    await Promise.all([a && deleteTestUser(a), b && deleteTestUser(b)]);
  });

  it('las definiciones de medida vienen en orden corporal y con ayuda', async () => {
    const defs = (await A.get('/measure-definitions')).body as { key: string; sort: number; help: string | null }[];
    const idx = (k: string) => defs.findIndex((d) => d.key === k);
    expect(idx('cuello')).toBeLessThan(idx('pecho'));
    expect(idx('pecho')).toBeLessThan(idx('cadera'));
    expect(defs.find((d) => d.key === 'cadera')!.help).toMatch(/parte más ancha/);
  });

  it('sin prendas asignadas pide las medidas base requeridas, en orden', async () => {
    const p = await plan();
    expect(p.items.map((i) => i.key)).toEqual(['cuello', 'ancho_espalda', 'pecho', 'largo_delantero', 'largo_trasero', 'cintura', 'cadera']);
    expect(p).toMatchObject({ total: 7, done: 0, missing: 7, status: 'none' });
    expect(p.items[0]!.requiredBy).toEqual([{ kind: 'base', label: 'Medidas base' }]);
  });

  it('al asignar una prenda pide las medidas de su molde y las de los diseños asignados', async () => {
    const design = (await A.post('/designs', {
      name: 'Aurora', garments: [{ moldTypeId: mold.pantalon!.id, laborCost: 1000 }], specialMeasureIds: [def.largo_hombro_rodilla],
    })).body;
    designId = design.id;
    expect((await A.post(`/groups/${groupId}/design-assignment`, { designId })).status).toBe(200);
    const p = await plan();
    const keys = p.items.map((i) => i.key);
    for (const k of pantsKeys()) expect(keys).toContain(k);
    expect(keys).toContain('largo_hombro_rodilla');
    expect(new Set(keys).size).toBe(keys.length);
    const special = p.items.find((i) => i.key === 'largo_hombro_rodilla')!;
    expect(special.requiredBy).toEqual([{ kind: 'design', label: 'Aurora' }]);
    expect(p.items.find((i) => i.key === pantsKeys()[0])!.requiredBy[0]).toEqual({ kind: 'garment', label: 'Pantalón' });
    const orders = p.items.map((i) => i.key);
    expect(orders.indexOf('largo_hombro_rodilla')).toBeLessThan(orders.indexOf('cadera'));
  });

  it('cargar medidas reduce los faltantes y cambia el estado', async () => {
    const before = await plan();
    await A.put(`/dancers/${dancerId}/measurements/${def[before.items[0]!.key]}`, { valueCm: 50 });
    const partial = await plan();
    expect(partial).toMatchObject({ done: 1, missing: before.total - 1, status: 'partial' });
    expect(partial.items[0]).toMatchObject({ value: 50 });
    for (const i of partial.items) await A.put(`/dancers/${dancerId}/measurements/${def[i.key]}`, { valueCm: 60 });
    expect(await plan()).toMatchObject({ missing: 0, status: 'complete' });
  });

  it('el estado de las listas usa lo asignado (bailarina completa vs bailarina sin medidas)', async () => {
    const list = (await A.get(`/groups/${groupId}/dancers`)).body as { id: string; measureStatus: string; requiredTotal: number; requiredDone: number }[];
    const emi = list.find((d) => d.id === dancerId)!;
    const ana = list.find((d) => d.id === otherId)!;
    expect(emi).toMatchObject({ measureStatus: 'complete' });
    expect(emi.requiredDone).toBe(emi.requiredTotal);
    expect(ana).toMatchObject({ measureStatus: 'none', requiredDone: 0 });
    const groups = (await A.get('/groups')).body as { id: string; complete: number; none: number; partial: number }[];
    expect(groups.find((g) => g.id === groupId)).toMatchObject({ complete: 1, none: 1, partial: 0 });
  });

  it('la matriz del grupo trae las medidas en orden, "no la pide" y totales', async () => {
    const g = (await A.get(`/groups/${groupId}/measure-plan`)).body;
    expect(g.measures.map((m: { key: string }) => m.key)).toContain('largo_hombro_rodilla');
    const ana = g.dancers.find((d: { id: string }) => d.id === otherId);
    expect(ana.cells).toHaveLength(g.measures.length);
    expect(ana.missing).toBe(ana.total);
    expect(g.totals.required).toBeGreaterThan(0);
    expect(g.totals.percent).toBeGreaterThan(0);
    expect(g.totals.percent).toBeLessThan(100);
    const only = (await A.get(`/groups/${groupId}/measure-plan?solo_faltantes=1`)).body;
    expect(only.dancers.map((d: { id: string }) => d.id)).toEqual([otherId]);
  });

  it('otra usuaria no ve el plan (404)', async () => {
    expect((await B.get(`/dancers/${dancerId}/measure-plan`)).status).toBe(404);
    expect((await B.get(`/groups/${groupId}/measure-plan`)).status).toBe(404);
  });
});
